
// Facebook Pixel Tracking Helpers
window.trackEvent = function (eventName, params = {}) {
    if (typeof fbq !== 'undefined') {
        fbq('track', eventName, params);
        console.log('FB Event Tracked:', eventName, params);
    }
};
