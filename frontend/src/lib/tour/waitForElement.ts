/** Espera a que un selector exista en el DOM (o hasta timeout). Devuelve null si no aparece. */
export function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el && !done) {
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        observer.disconnect();
        resolve(null);
      }
    }, timeout);
  });
}
