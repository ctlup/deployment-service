/**
 * Checks two sets for equality
 * @param {Set} s1 
 * @param {Set} s2 
 * @returns {Boolean}
 */
export function areSetsEqual(s1, s2) {
    return (s1.size === s2.size) && [...s1].every(el => s2.has(el))
}