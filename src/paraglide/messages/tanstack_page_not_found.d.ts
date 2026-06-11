/**
* | output |
* | --- |
* | "Page not found" |
*
* @param {Tanstack_Page_Not_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" | "zh-TW" }} options
* @returns {LocalizedString}
*/
export const tanstack_page_not_found: ((inputs?: Tanstack_Page_Not_FoundInputs, options?: {
    locale?: "en" | "zh" | "zh-TW";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Tanstack_Page_Not_FoundInputs, {
    locale?: "en" | "zh" | "zh-TW";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Tanstack_Page_Not_FoundInputs = {};
