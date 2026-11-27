/**
 * Returns a function that gives back what `make` made, and the very same
 * value again for as long as it is called with the same `key`. A stroke layer
 * redraws when it is shown a new list, so a list that would come out the same
 * is not made twice: a page of writing is drawn eight times a second, when it
 * boils, and not sixty.
 */
export function keepWhileUnchanged<Made>(): (key: string, make: () => Made) => Made {
  let last: { key: string; made: Made } | undefined;
  return (key, make) => {
    if (!last || last.key !== key) last = { key, made: make() };
    return last.made;
  };
}
