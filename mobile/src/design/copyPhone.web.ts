export async function copyPhone(number: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(number); return true; } } catch {}
  // Also support development over HTTP LAN, where Clipboard API is unavailable.
  const input = document.createElement('textarea');
  input.value = number; input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
  const previous = document.activeElement as HTMLElement | null;
  document.body.appendChild(input);
  try { input.select(); return document.execCommand('copy'); }
  catch { return false; }
  finally { input.remove(); previous?.focus(); }
}
