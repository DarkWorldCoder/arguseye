// $app/forms: use:enhance keeps the form on the page; nothing is submitted from a preview.
export const enhance = (form) => {
  const stop = (event) => event.preventDefault();
  form.addEventListener("submit", stop);
  return { destroy: () => form.removeEventListener("submit", stop) };
};
export const applyAction = async () => {};
export const deserialize = (text) => JSON.parse(text);
