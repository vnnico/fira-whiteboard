// whiteboard/utils/updateElement.js

/**
 * Update satu elemen dalam array.
 * updater boleh object (merge) atau function(el) => newEl.
 */
export function updateElement(elements, id, updater) {
  let updatedElement = null;

  const updated = elements.map((el) => {
    if (!el || el.id !== id) return el;

    if (typeof updater === "function") {
      updatedElement = updater(el);
    } else {
      updatedElement = { ...el, ...updater };
    }
    return updatedElement;
  });

  return { elements: updated, element: updatedElement };
}
