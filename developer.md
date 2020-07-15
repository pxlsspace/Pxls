# Developer Documentation

This file serves as a mini-documentation for a small set features in `pxls.js`, for use either in either internal or external development (such as userscripts).

All components are accessible via `self` internally, or `App` externally. For the sake of the examples provided here, we will be using `App`.

## Templating

Templating is already provided via URL parameters, but is easily modifiable via scripts.
For that there is `App.updateTemplate()`. It works by passing a template-object as an argument. A full template object looks like the following:

```js
App.updateTemplate({
    use: true, // boolean, whether to use the template or not
    url: 'https://example.com/image.png', // string, url of image
    x: 5, // float, x-position of image
    y: 42, // float, y-position of image
    width: 7, // float, width of image, if scaling is desired
    opacity: 0.5, // float, opacity, 0 min, 1 max
});
```

You can omit keys if wanted:

```js
// initialize the template
App.updateTemplate({
    use: true,
    url: 'https://example.com/image.png',
    x: 1337,
    y: 3
});

// ...

// hide the template
App.updateTemplate({ opacity: 0 });

// ...

// show the template
App.updateTemplate({ opacity: 1 });
```

Note that if `use` is set to `false`, previous parameters will be forgotten.
It's best to assign the template data to an object and supply that, or set `opacity` to hide it.

## Storage

We also provide storage wrappers for `localStorage` (`ls`) and `sessionStorage` (`ss`).
Both have a fallback to cookies, 99-days or session-cookies, depending on the type of storage.

It is possible to store anything that can be expressed via JSON.

```js
App.ls.set('blah', 42); // sets 'blah' to 42
App.ls.get('blah'); // 42
App.ls.set('blah', { a: 'b' }); // sets 'blah' to the object
App.ls.get('blah'); // { a: 'b' }
App.ls.remove('blah');
App.ls.get('blah'); // undefined
```

## Settings

It is possible to change settings using the settings object in a program-friendly way.
Using the following functions will cause the changes to be reflected internally as well as update settings controls to reflect new values.

```js
App.settings.board.heatmap.enable.set(true); // enable the heatmap
App.settings.ui.cursor.enable.toggle(); // enable/disable the cursor
App.settings.board.zoom.sensitivity.set(2); // set the zoom sensitivity
App.settings.audio.alert.volume.get(); // returns the current alert volume
```

The various settings keys can be found in-code or through a browser auto-complete if needed.
They will generally be named like this: `component.feature.subfeature.setting`.

Also note that the `.toggle()` function is only available for boolean settings (usually those ending in `.enable`).

## Lookup Hooks

Hooks are objects that provide extra functionality for lookups.
In the example, `data` supplied to `get` would be lookup information, while properties in `css` are assigned to their values.

```js
App.lookup.registerHook({
    id: "rebel_hook",
    name: "Rebellious Hook",
    get: data => `Hehehe... the X is ${data.x} and Y is ${data.y}...`,
    css: {
        color: "yellow",
    },
});
```

Your function's return value can either be a jQuery object, a string (later wrapped in a `span`), or null (signaling the hook shouldn't be included).

## Chat Hooks

Similar to lookup hooks, hooks can also be used to intercept chat messages and highlight messages the same way a ping does.

Below is an example of a hook that would make every message a ping.
In it, `data` supplied to `get` would be message information.
This data contains `message_raw` which is the raw text of the message as well as other values such as `author`, `date` and more.

```js
App.chat.registerHook({
    id: "annoying_hook",
    get: data => ({
        pings: [
            {
                start: 0,
                length: data.message_raw.length,
                highlight: false
            }
        ]
    })
});
```

Your function's return value should be an object containing an array object in the key `pings` which contains one or more ping objects.
A ping object contains three keys as shown in the example: `start`, `length`, and `highlight`.
While not currently used, these values are used to indicate if a message should highlighted as a ping and what section in it if so.

## Chat Markdown

Markdown processing in chat is backed by [pxls-markdown](https://github.com/pxlsspace/pxls-markdown), which uses [unified](https://github.com/unifiedjs/unified), [remark-parse](https://github.com/remarkjs/remark/tree/master/packages/remark-parse) and a combination of custom plugins to handle __underlines__, @mentions, :emoji: 😄, etc; as well as converting the syntax tree into DOM elements.

The [Processor](https://github.com/unifiedjs/unified#processors) is exposed in `App.chat.markdownProcessor`. You can extend its functionality by creating a [Plugins](https://github.com/unifiedjs/unified#plugin) and doing `App.chat.markdownProcessor.use(yourPlugin)`.

You can read more on how the processor works on [unified's README](https://github.com/unifiedjs/unified#description) or by [checking the sourcecode of plugins on the pxls-markdown repository](https://github.com/pxlsspace/pxls-markdown/tree/master/plugins).

```js
function myPlugin() {
    const parserProto = this.Parser.prototype;
    const compilerProto = this.Compiler.prototype;

    /*
     * Inject a new inline tokenizer into the Parser (remark-parse)
     */

    // inlineMethods contains a list of parserProto.inlineTokenizers functions to run
    // sequentially. This is why we add the name of our new tokenizer to the beginning, as to
    // avoid any conflicts with other tokenizers.
    parserProto.inlineMethods.splice(0, 0, 'myCustomMarkup');

    parserProto.inlineTokenizers.myCustomMarkup = function tokenizer(eat, value, silent) {
        if (value.startsWith('test')) {
            if (silent) {
                // If in silent mode, we are only asserting that we've found our markup.
                return true;
            }

            // we eat "test" from the input and replace it with a Node of type "myCustomMarkup" and value "test"
            return eat('test')({
                type: 'myCustomMarkup',
                value: 'test'
            });
        }

        return false;
    }
    parserProto.inlineTokenizers.myCustomMarkup.notInLink = true;
    parserProto.inlineTokenizers.myCustomMarkup.locator = function(value, fromIndex) {
        // A tokenizer's locator returns the location of where our markup starts, or -1 if not found,
        // for optimization purposes.
        // * A constant value of -1 will make our tokenizer only run at the beginning of the source string.
        // * A constant value of 0 will generate an infinite loop.
        return value.indexOf('test', fromIndex);
    }

    /*
     * Inject a new visitor into the Compiler (remark-crel)
     */
    compilerProto.visitors.myCustomMarkup = (node, next) => {
        // calling next() will recursively visit all childrens of our node (node.children)
        // or return the value of our node (node.value) if it has no children.

        const style = 'font-weight: bold; font-style: italic; text-decoration: underline;';
        return crel('span', { style }, next())
    };
}

App.chat.markdownProcessor.use(myPlugin);
```

## Global Events

You can listen for various custom $(window) events triggered with the `pxls:` prefix. Note that these are only listen-able with jQuery.

Examples:
```js
$(window).on('pxls:ack:place', (event, x, y) => {
    console.log("Pixel succesfully placed at (" + x + ", " + y + ")");
});

$(window).on('pxls:ack:undo', (event, x, y) => {
    console.log("Pixel succesfully undoed at (" + x + ", " + y + ")");
});

$(window).on('pxls:pixelCounts:update', (event, counts) => {
    console.log("New pixel count: " + counts.pixelCount + " current, " + counts.pixelCountAllTime + " all time");
});


/** Events used internally but still available to anyone **/
$(window).on('pxls:panel:opened', (event, panelDescriptor) => {
    console.log("Opened panel " + panelDescriptor);
});

$(window).on('pxls:panel:closed', (event, panelDescriptor) => {
    console.log("Closed panel " + panelDescriptor);
});

$(window).on('pxls:queryUpdated', (event, propName, oldValue, newValue) => {
    if (oldValue !== newValue) {
        console.log("Query property " + propName + " changed from " + oldValue + " to " + newValue);
    }
});

$(window).on("pxls:user:loginState", function(e, isLoggedIn) {
    console.log(isLoggedIn ? "Client is logged in" : "Client isn't logged in");
})
```
