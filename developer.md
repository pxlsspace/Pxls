# Developer Documentation
What this file is for is to document the different features for developers to either use inside of `pxls.js` when doing dev or what is exposed so that other people can write their own userscripts to do cool stuff!

All the things are called via the object, in case of inside of the `pxls.js` tis is `self`, for the outside it is `App`. This documentation will just use the `App` notation.

## Templating
Templating is already provided via URL parameters, but you can easily modify it via scripts. For that there is `App.updateTemplate()`. It works by passing a template-object as an argument. A full template object looks like the following:
```
App.updateTemplate({
	use: true, // boolean, true/false
	url: 'https://example.com/image.png', // string, url of image
	x: 5, // float, x-position of image
	y: 42, // float, y-position of image
	width: 7, // float, width of image, if scaling is desired
	opacity: 0.5, // opacity, 1 is max, 0 is min
});
```
You can omit any keys if you want. For example:
```
// initialize the template
App.updateTemplate({
	use: true,
	url: 'https://example.com/image.png',
	x: 1337,
	y: 3
});

// some code

// hide the template
App.updateTemplate({
	opacity: 0
});

// other code

// show the template
App.updateTemplate({
	opacity: 1
});
```
Please note that once you set `use` to `false` it will forget all previously set parameters, so either keep track of an entire template object or, if you want to toggle it on/off, set the opacity to 0 instead.

## Storage
We also provide powerful storage wrappers for `localStorage` and `sessionStorage`. Both have a fallback to cookies, 99-days or session-cookies, depending on the type of storage. Both handlers are same to be used, here will be stated `App.ls`, which is the localStorage handler. `App.ss` is the respective sessionStorage handler.

It is possible to store any json-ify-able thing.
```
App.ls.set('blah', 42); // sets 'blah' to 42
App.ls.get('blah'); // returns 42
App.ls.set('blah', {a: 'b'}); // sets an object in 'blah'
App.ls.get('blah'); // returns the object
App.ls.remove('blah'); // remove the contents of blah
App.ls.get('blah'); // not defined, returns undefined
```
