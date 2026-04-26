/**
 * Remote switch for the Cotton AI marketing home page (index) password gate.
 * - true  = require 12h key before showing the home page
 * - false = home page is public
 *
 * Edit this file and deploy this repo. The main Cotton site must load it via
 * the script URL in index.html (same origin as the booth deployment).
 */
window.__COTTON_SITE_AUTH = false;
