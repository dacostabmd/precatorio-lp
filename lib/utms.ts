/**
 * Utilitário para captura e persistência de parâmetros de rastreamento de marketing (UTMs, GCLID, FBCLID).
 * Armazena no sessionStorage do navegador para garantir atribuição mesmo com navegação interna.
 */

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
}

const STORAGE_KEY = 'premium_office_utms';

export function capturarUtms(): UtmParams {
  if (typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const existing = sessionStorage.getItem(STORAGE_KEY);
    const currentStored: UtmParams = existing ? JSON.parse(existing) : {};

    const utm_source = params.get('utm_source') || currentStored.utm_source;
    const utm_medium = params.get('utm_medium') || currentStored.utm_medium;
    const utm_campaign = params.get('utm_campaign') || currentStored.utm_campaign;
    const utm_content = params.get('utm_content') || currentStored.utm_content;
    const utm_term = params.get('utm_term') || currentStored.utm_term;
    const gclid = params.get('gclid') || currentStored.gclid;
    const fbclid = params.get('fbclid') || currentStored.fbclid;
    const referrer = document.referrer || currentStored.referrer;

    const utms: UtmParams = {};
    if (utm_source) utms.utm_source = utm_source;
    if (utm_medium) utms.utm_medium = utm_medium;
    if (utm_campaign) utms.utm_campaign = utm_campaign;
    if (utm_content) utms.utm_content = utm_content;
    if (utm_term) utms.utm_term = utm_term;
    if (gclid) utms.gclid = gclid;
    if (fbclid) utms.fbclid = fbclid;
    if (referrer) utms.referrer = referrer;

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utms));
    return utms;
  } catch (e) {
    console.warn('[utms] Falha ao capturar UTMs:', e);
    return {};
  }
}

export function obterUtmsArmazenadas(): UtmParams {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : capturarUtms();
  } catch {
    return {};
  }
}
