import type { Brand } from '../catalog/types.ts';
import { DEFAULT_ADJUST, DEFAULT_SETTINGS, type Adjustments, type OutputSettings } from '../pipeline/types.ts';
import type { TextKey } from '../i18n/keys.ts';

export type FileStatus = 'loading' | 'ready' | 'error';

export interface ImageItem {
  id: string;
  file: File;
  /** Editable base name without extension. */
  name: string;
  status: FileStatus;
  error?: { key: TextKey; params?: Record<string, string | number> };
  width: number;
  height: number;
  thumbUrl?: string;
  overrides: Partial<OutputSettings>;
  adjust: Adjustments;
}

export type Scope = 'all' | 'one';

export interface AppState {
  images: ImageItem[];
  selectedId: string | null;
  deviceId: string | null;
  methodId: string | null;
  batch: OutputSettings;
  scope: Scope;
  query: string;
  brands: Brand[];
  colorFilter: 'any' | 'color' | 'grayscale';
}

export const DEFAULT_DEVICE = 'xteink-x4';

export const initialState: AppState = {
  images: [],
  selectedId: null,
  deviceId: DEFAULT_DEVICE,
  methodId: null,
  batch: DEFAULT_SETTINGS,
  scope: 'all',
  query: '',
  brands: [],
  colorFilter: 'any',
};

export type Action =
  | { type: 'addImages'; items: ImageItem[] }
  | { type: 'updateImage'; id: string; patch: Partial<ImageItem> }
  | { type: 'removeImage'; id: string }
  | { type: 'removeAll' }
  | { type: 'select'; id: string | null }
  | { type: 'selectDevice'; id: string | null }
  | { type: 'selectMethod'; id: string | null }
  | { type: 'setScope'; scope: Scope }
  | { type: 'setSettings'; patch: Partial<OutputSettings> }
  | { type: 'resetOverrides'; id: string }
  | { type: 'setAdjust'; id: string; patch: Partial<Adjustments> }
  | { type: 'resetAdjust'; id: string }
  | { type: 'setQuery'; query: string }
  | { type: 'toggleBrand'; brand: Brand }
  | { type: 'setColorFilter'; value: AppState['colorFilter'] }
  | { type: 'clearFilters' };

export function effectiveSettings(state: Pick<AppState, 'batch'>, item: ImageItem | undefined): OutputSettings {
  return item ? { ...state.batch, ...item.overrides } : state.batch;
}

export function hasOverrides(item: ImageItem): boolean {
  return Object.keys(item.overrides).length > 0;
}

function patchImage(state: AppState, id: string, fn: (item: ImageItem) => ImageItem): AppState {
  return { ...state, images: state.images.map((i) => (i.id === id ? fn(i) : i)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addImages': {
      const images = [...state.images, ...action.items];
      return { ...state, images, selectedId: state.selectedId ?? action.items[0]?.id ?? null };
    }
    case 'updateImage':
      return patchImage(state, action.id, (i) => ({ ...i, ...action.patch }));
    case 'removeImage': {
      const index = state.images.findIndex((i) => i.id === action.id);
      const images = state.images.filter((i) => i.id !== action.id);
      let selectedId = state.selectedId;
      if (selectedId === action.id) selectedId = images[Math.min(index, images.length - 1)]?.id ?? null;
      return { ...state, images, selectedId, scope: images.length ? state.scope : 'all' };
    }
    case 'removeAll':
      return { ...state, images: [], selectedId: null, scope: 'all' };
    case 'select':
      return { ...state, selectedId: action.id };
    case 'selectDevice':
      return {
        ...state,
        deviceId: action.id,
        methodId: null,
        batch: action.id ? { ...state.batch, target: 'device' } : { ...state.batch, target: 'custom' },
      };
    case 'selectMethod':
      return { ...state, methodId: action.id };
    case 'setScope':
      return { ...state, scope: action.scope };
    case 'setSettings': {
      if (state.scope === 'one' && state.selectedId) {
        return patchImage(state, state.selectedId, (i) => ({ ...i, overrides: { ...i.overrides, ...action.patch } }));
      }
      return { ...state, batch: { ...state.batch, ...action.patch } };
    }
    case 'resetOverrides':
      return patchImage(state, action.id, (i) => ({ ...i, overrides: {} }));
    case 'setAdjust':
      return patchImage(state, action.id, (i) => ({ ...i, adjust: { ...i.adjust, ...action.patch } }));
    case 'resetAdjust':
      return patchImage(state, action.id, (i) => ({ ...i, adjust: DEFAULT_ADJUST }));
    case 'setQuery':
      return { ...state, query: action.query };
    case 'toggleBrand': {
      const has = state.brands.includes(action.brand);
      return { ...state, brands: has ? state.brands.filter((b) => b !== action.brand) : [...state.brands, action.brand] };
    }
    case 'setColorFilter':
      return { ...state, colorFilter: action.value };
    case 'clearFilters':
      return { ...state, query: '', brands: [], colorFilter: 'any' };
  }
}
