export function showModal(title, body, submitLabel='Save', formType='generic') {
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">${title}</h2><button class="icon-btn" type="button" data-close-modal aria-label="Close">×</button></header><form id="nexus-modal-form" data-form="${formType}"><div class="modal-body">${body}</div><footer><button class="btn" type="button" data-close-modal>Cancel</button><button class="btn primary" type="submit">${submitLabel}</button></footer></form></section></div>`;
  return root.querySelector('#nexus-modal-form');
}
export function closeModal() { document.querySelector('#modal-root').innerHTML=''; }
