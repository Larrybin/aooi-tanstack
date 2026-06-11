/**
* | output |
* | --- |
* | "Back to Home" |
*
* @param {Tanstack_Back_HomeInputs} inputs
* @param {{ locale?: "en" | "zh" | "zh-TW" }} options
* @returns {LocalizedString}
*/
export const tanstack_back_home: ((inputs?: Tanstack_Back_HomeInputs, options?: {
    locale?: "en" | "zh" | "zh-TW";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Tanstack_Back_HomeInputs, {
    locale?: "en" | "zh" | "zh-TW";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Tanstack_Back_HomeInputs = {};
