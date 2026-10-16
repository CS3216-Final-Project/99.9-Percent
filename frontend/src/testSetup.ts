// jsdom has no layout, so it leaves out scrolling. The guides scroll a panel to the control they point at.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
// The details panel scrolls back to its top on each selection.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
