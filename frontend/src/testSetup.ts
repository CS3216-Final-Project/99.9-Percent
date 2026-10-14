// jsdom has no layout, so it leaves out scrolling. The guides scroll a panel to the control they point at.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
