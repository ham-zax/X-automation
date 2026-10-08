// Native Chrome dialogs can be invisible to CDP page snapshots.
// Only cancel before-unload dialogs in the WebHarness-owned Chrome profile.
import { execFileSync } from 'node:child_process';

if (process.argv.slice(2).some(arg => arg !== '--dismiss')) {
  throw new Error('Usage: node ops/windows-dialog-recovery.mjs [--dismiss]');
}
const dismiss = process.argv.includes('--dismiss') ? '$true' : '$false';
const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Leave site?')
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$found = 0
$cancelled = 0
$remaining = 0
foreach ($window in $windows) {
  if ($window.Current.ClassName -ne 'Chrome_WidgetWin_1') { continue }
  $process = Get-CimInstance Win32_Process -Filter ('ProcessId = '+$window.Current.ProcessId)
  if ($process.Name -ne 'chrome.exe' -or $process.CommandLine -notmatch '[\\\\/]mcp-dev-bridge[\\\\/]chrome-profile(?:"|\\s|$)') { continue }
  $dialogs = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach ($dialog in $dialogs) {
    if ($dialog.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window) { continue }
    $found++
    if (${dismiss}) {
      $cancelCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Cancel')
      $cancel = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$cancelCondition)
      if ($null -eq $cancel -or $cancel.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { throw 'Exact Cancel button unavailable' }
      $cancel.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      $cancelled++
    }
  }
  if (${dismiss}) { Start-Sleep -Milliseconds 300 }
  $after = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach ($dialog in $after) {
    if ($dialog.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) { $remaining++ }
  }
}
@{found=$found; cancelled=$cancelled; remaining=$remaining} | ConvertTo-Json -Compress
if (${dismiss} -and $remaining -gt 0) { exit 1 }
`;
const output = execFileSync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 30_000 });
process.stdout.write(output);
