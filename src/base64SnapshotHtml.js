const ChromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');

module.exports = async function (url) {
  let protocol;
  let chrome;
  try {
    console.debug(`Headless rendering ${url}`);
    chrome = await ChromeLauncher.launch({
      startingUrl: url,
      chromeFlags: ['--headless', '--disable-gpu', '--window-size=1280,720'],
      logLevel: process.env.DEBUG && "verbose"
    });
    console.debug("Attaching to port ", chrome.port);
    protocol = await CDP({
      port: chrome.port
    });
    const {
      DOM,
      Page,
      Runtime
    } = protocol;

    console.debug('Enabling Page');
    await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);

    console.debug('Capturing screenshot');
    const screenshot = await Page.captureScreenshot({ format: 'png', fromSurface: true });
    return screenshot.data;

  }
  finally {
    console.debug("Cleaning up resources");
    protocol && protocol.close();
    chrome && chrome.kill();
  }


};
