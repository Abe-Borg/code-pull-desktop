import { spawn } from 'node:child_process'
import { SECRET_SERVICE, type SecretStore } from './types'

const SCRIPT = `
$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()
$req = $raw | ConvertFrom-Json
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CodePullCred {
  public const uint GENERIC = 1;
  public const uint LOCAL = 2;
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite(ref CREDENTIAL credential, uint flags);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDelete(string target, uint type, uint flags);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr credential);
}
"@
function Target([string]$account) { return "$($req.service):$account" }
if ($req.action -eq 'get') {
  $ptr = [IntPtr]::Zero
  $ok = [CodePullCred]::CredRead((Target $req.account), 1, 0, [ref]$ptr)
  if (-not $ok) { Write-Output ''; exit 0 }
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CodePullCred+CREDENTIAL])
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $bytes.Length)
  [CodePullCred]::CredFree($ptr)
  Write-Output ([Text.Encoding]::UTF8.GetString($bytes))
  exit 0
}
if ($req.action -eq 'delete') {
  [void][CodePullCred]::CredDelete((Target $req.account), 1, 0)
  exit 0
}
if ($req.action -eq 'set') {
  $bytes = [Text.Encoding]::UTF8.GetBytes([string]$req.secret)
  $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
  $cred = New-Object CodePullCred+CREDENTIAL
  $cred.Type = 1
  $cred.TargetName = Target $req.account
  $cred.CredentialBlobSize = [uint32]$bytes.Length
  $cred.CredentialBlob = $blob
  $cred.Persist = 2
  $cred.UserName = [string]$req.account
  $cred.Comment = 'Code Pull Desktop'
  $ok = [CodePullCred]::CredWrite([ref]$cred, 0)
  [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
  if (-not $ok) { Write-Error 'CredWrite failed'; exit 1 }
  exit 0
}
Write-Error 'Unknown action'
exit 1
`

/**
 * Windows Credential Manager via the built-in PowerShell host.
 * Used when the native keytar addon is not rebuilt for this Electron binary,
 * which is the case for the unsigned installer produced off Windows.
 */
export class WinCredPowerShellStore implements SecretStore {
  readonly backend = 'credential-manager' as const

  location(account = 'claude-api-key'): string {
    return `Windows Credential Manager (${SECRET_SERVICE}:${account})`
  }

  async get(account = 'claude-api-key'): Promise<string | null> {
    const value = (await this.run({ action: 'get', account })).trim()
    return value || null
  }

  async set(secret: string, account = 'claude-api-key'): Promise<void> {
    await this.run({ action: 'set', account, secret })
  }

  async delete(account = 'claude-api-key'): Promise<void> {
    await this.run({ action: 'delete', account })
  }

  private run(body: { action: string; account: string; secret?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
        { windowsHide: true },
      )
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk
      })
      child.on('error', (error) => reject(error))
      child.on('close', (code) => {
        if (code === 0) resolve(stdout)
        else reject(new Error(stderr.trim() || `Credential Manager helper exited ${code ?? 'unknown'}.`))
      })
      child.stdin.write(JSON.stringify({ service: SECRET_SERVICE, ...body }))
      child.stdin.end()
    })
  }
}
