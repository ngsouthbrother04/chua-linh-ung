import dotenv from 'dotenv';
import { validateTtsRuntimeConfig } from '../services/ttsService';

dotenv.config();

const validation = validateTtsRuntimeConfig();

if (validation.ok) {
  console.log('[TTS] Runtime config is valid.');
} else {
  console.error('[TTS] Runtime config is invalid.');
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}

if (validation.warnings.length > 0) {
  console.warn('[TTS] Warnings:');
  for (const warning of validation.warnings) {
    console.warn(`- ${warning}`);
  }
}
