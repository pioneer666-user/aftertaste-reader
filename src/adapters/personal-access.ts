import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const options = { windowsHide: true, timeout: 30_000 };

// Use the same exclusive handle to create, verify and write the protected file.
const windowsAccess = Buffer.from(String.raw`
$ErrorActionPreference = 'Stop'
$sections = [Security.AccessControl.AccessControlSections]'Access, Owner, Group'
$target = $env:AFTERTASTE_ACL_TARGET
$candidate = $env:AFTERTASTE_ACL_TEMP
if ($env:AFTERTASTE_ACL_EXISTING -eq '1') {
    $acl = [IO.File]::GetAccessControl($target, $sections)
} else {
    $acl = New-Object Security.AccessControl.FileSecurity
    $acl.SetSecurityDescriptorSddlForm('D:P(A;;FA;;;SY)(A;;FA;;;' + [Security.Principal.WindowsIdentity]::GetCurrent().User.Value + ')')
}
if ($env:AFTERTASTE_ACL_VERIFY -eq '1') {
    if ($acl.GetSecurityDescriptorSddlForm($sections) -cne $env:AFTERTASTE_ACL_VERIFY_VALUE) { exit 3 }
    exit 0
}
$created = $false
try {
    $rights = [Security.AccessControl.FileSystemRights]'Write, ReadPermissions'
    $stream = [IO.FileStream]::new($candidate, [IO.FileMode]::CreateNew,
        $rights, [IO.FileShare]::None, 4096, [IO.FileOptions]::None, $acl)
    $created = $true
    try {
        $actual = $stream.GetAccessControl()
        $expected = ''
        if ($env:AFTERTASTE_ACL_EXISTING -eq '1') {
            $expected = $acl.GetSecurityDescriptorSddlForm($sections)
            # CreateFile may omit the auto-inherited bookkeeping flag while keeping every ACE.
            $inheritedFlag = 'D:(P?)AI(?=\()'
            if (($actual.GetSecurityDescriptorSddlForm($sections) -creplace $inheritedFlag, 'D:$1') -cne
                ($expected -creplace $inheritedFlag, 'D:$1')) { throw 'ACL mismatch' }
        } elseif ($actual.GetSecurityDescriptorSddlForm('Access') -cne $acl.GetSecurityDescriptorSddlForm('Access')) {
            throw 'ACL mismatch'
        }
        [Console]::OpenStandardInput().CopyTo($stream)
        $stream.Flush($true)
    } finally {
        $stream.Dispose()
    }
    [Console]::Write($expected)
} catch {
    if ($created) { [IO.File]::Delete($candidate) }
    exit 2
}
`, 'utf16le').toString('base64');

export async function windowsPersonalAccess(target: string, candidate: string, existing: boolean,
  action: { raw: string } | { verify: string }): Promise<string> {
  const shell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    return await new Promise((resolve, reject) => {
      const child = execFile(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', windowsAccess], {
        ...options, env: { ...process.env, AFTERTASTE_ACL_TARGET: target, AFTERTASTE_ACL_TEMP: candidate,
          AFTERTASTE_ACL_EXISTING: existing ? '1' : '0', AFTERTASTE_ACL_VERIFY: 'verify' in action ? '1' : '0',
          AFTERTASTE_ACL_VERIFY_VALUE: 'verify' in action ? action.verify : '' },
      }, (error, stdout) => error ? reject(error) : resolve(stdout));
      child.stdin?.on('error', reject);
      child.stdin?.end('raw' in action ? action.raw : undefined, 'utf8');
    });
  } catch (error) {
    const code = 'verify' in action && error instanceof Error && 'code' in error && error.code === 3
      ? 'ACL_CHANGED' : 'WINDOWS_ACL_UNAVAILABLE';
    throw Object.assign(new Error(code), { code });
  }
}

export async function preparePosixAccess(target: string, candidate: string, existing: boolean): Promise<void> {
  try {
    if (process.platform === 'linux' && existing) {
      // GNU cp preserves the POSIX ACL as part of the mode, without copying the payload.
      await run('cp', ['--attributes-only', '--preserve=mode,ownership', '--', target, candidate], options);
    } else if (process.platform === 'darwin') {
      await run('/bin/chmod', ['-N', candidate], options);
      if (existing) await run('/bin/cp', ['-p', target, candidate], options);
    } else if (existing) {
      throw new Error('Unsupported ACL preservation');
    }
  } catch {
    throw Object.assign(new Error('POSIX_PERMISSIONS_UNAVAILABLE'), { code: 'POSIX_PERMISSIONS_UNAVAILABLE' });
  }
}
