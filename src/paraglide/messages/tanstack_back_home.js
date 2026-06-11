/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Tanstack_Back_HomeInputs */

const en_tanstack_back_home = /** @type {(inputs: Tanstack_Back_HomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to Home`)
};

const zh_tanstack_back_home = /** @type {(inputs: Tanstack_Back_HomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`返回首页`)
};

const zh_tw2_tanstack_back_home = /** @type {(inputs: Tanstack_Back_HomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`返回首頁`)
};

/**
* | output |
* | --- |
* | "Back to Home" |
*
* @param {Tanstack_Back_HomeInputs} inputs
* @param {{ locale?: "en" | "zh" | "zh-TW" }} options
* @returns {LocalizedString}
*/
export const tanstack_back_home = /** @type {((inputs?: Tanstack_Back_HomeInputs, options?: { locale?: "en" | "zh" | "zh-TW" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Tanstack_Back_HomeInputs, { locale?: "en" | "zh" | "zh-TW" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tanstack_back_home(inputs)
	if (locale === "zh") return zh_tanstack_back_home(inputs)
	return zh_tw2_tanstack_back_home(inputs)
});