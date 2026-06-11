/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Tanstack_Page_Not_FoundInputs */

const en_tanstack_page_not_found = /** @type {(inputs: Tanstack_Page_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Page not found`)
};

const zh_tanstack_page_not_found = /** @type {(inputs: Tanstack_Page_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`页面未找到`)
};

const zh_tw2_tanstack_page_not_found = /** @type {(inputs: Tanstack_Page_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`頁面未找到`)
};

/**
* | output |
* | --- |
* | "Page not found" |
*
* @param {Tanstack_Page_Not_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" | "zh-TW" }} options
* @returns {LocalizedString}
*/
export const tanstack_page_not_found = /** @type {((inputs?: Tanstack_Page_Not_FoundInputs, options?: { locale?: "en" | "zh" | "zh-TW" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tanstack_Page_Not_FoundInputs, { locale?: "en" | "zh" | "zh-TW" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tanstack_page_not_found(inputs)
	if (locale === "zh") return zh_tanstack_page_not_found(inputs)
	return zh_tw2_tanstack_page_not_found(inputs)
});