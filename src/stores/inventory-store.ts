import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { z } from 'zod';

const legacyProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  category: z.string(),
  location: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  expiry: z.string(),
  status: z.enum(['Good', 'Low stock', 'Expiring']),
  condition: z.enum(['Good', 'Use soon', 'Needs attention']),
  icon: z.string(),
});

const barcodeFormatSchema = z.enum(['ean13', 'ean8', 'upc_a', 'upc_e']);

const productSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  category: z.string(),
  location: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  expiry: z.string().nullable(),
  reorderLevel: z.number().nonnegative().nullable(),
  barcode: z.string().nullable(),
  barcodeFormat: barcodeFormatSchema.nullable(),
  condition: z.enum(['Good', 'Needs attention']),
  icon: z.string(),
});

const legacyActivityTypeSchema = z.enum([
  'product-added',
  'product-edited',
  'product-deleted',
  'quantity-changed',
  'location-changed',
]);

const activityTypeSchema = z.enum([
  'product-added',
  'product-edited',
  'product-deleted',
  'quantity-changed',
  'location-changed',
  'threshold-changed',
]);

const activitySchema = z.object({
  id: z.number().int().positive(),
  type: activityTypeSchema,
  productName: z.string(),
  detail: z.string(),
  createdAt: z.string().datetime(),
});

const legacyActivitySchema = z.object({
  id: z.number().int().positive(),
  type: legacyActivityTypeSchema,
  productName: z.string(),
  detail: z.string(),
  createdAt: z.string().datetime(),
});

const legacySavedStateSchema = z.object({
  version: z.literal(1),
  inventory: z.array(legacyProductSchema),
  activity: z.array(legacyActivitySchema),
});

const savedStateSchema = z.object({
  version: z.literal(2),
  inventory: z.array(productSchema),
  activity: z.array(activitySchema),
});

export type Product = z.infer<typeof productSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type ActivityEntry = z.infer<typeof activitySchema>;
export type RetailBarcodeFormat = z.infer<typeof barcodeFormatSchema>;
export type ScannedBarcode = { value: string; format: RetailBarcodeFormat };
export type ProductInput = Omit<Product, 'id'>;

type SavedState = z.infer<typeof savedStateSchema>;
type ActivityInput = Omit<ActivityEntry, 'id' | 'createdAt'>;
type LoadStatus = 'loading' | 'ready' | 'error';

const STORAGE_KEY = 'sortie:household-state:v2';
const LEGACY_STORAGE_KEY = 'sortie:household-state:v1';

const initialProducts: Product[] = [
  { id: 1, name: 'Whole Milk', category: 'Dairy', location: 'Refrigerator', quantity: 2, unit: 'cartons', expiry: 'Nov 17, 2026', reorderLevel: null, barcode: null, barcodeFormat: null, condition: 'Good', icon: '🥛' },
  { id: 2, name: 'Jasmine Rice', category: 'Grains', location: 'Pantry', quantity: 5, unit: 'kg', expiry: 'Aug 12, 2027', reorderLevel: null, barcode: null, barcodeFormat: null, condition: 'Good', icon: '🍚' },
  { id: 3, name: 'Olive Oil', category: 'Condiments', location: 'Pantry', quantity: 1, unit: 'bottle', expiry: 'Mar 08, 2027', reorderLevel: 2, barcode: null, barcodeFormat: null, condition: 'Needs attention', icon: '🫒' },
  { id: 4, name: 'Free-range Eggs', category: 'Dairy', location: 'Refrigerator', quantity: 6, unit: 'pcs', expiry: 'Nov 19, 2026', reorderLevel: null, barcode: null, barcodeFormat: null, condition: 'Good', icon: '🥚' },
  { id: 5, name: 'Chicken Breast', category: 'Meat', location: 'Freezer', quantity: 3, unit: 'packs', expiry: 'Jan 14, 2027', reorderLevel: null, barcode: null, barcodeFormat: null, condition: 'Good', icon: '🍗' },
  { id: 6, name: 'Orange Juice', category: 'Beverages', location: 'Refrigerator', quantity: 1, unit: 'carton', expiry: 'Nov 16, 2026', reorderLevel: null, barcode: null, barcodeFormat: null, condition: 'Good', icon: '🍊' },
];

let writeQueue: Promise<void> = Promise.resolve();

function writeSavedState(state: SavedState) {
  const value = JSON.stringify(state);
  const write = writeQueue.then(
    () => AsyncStorage.setItem(STORAGE_KEY, value),
    () => AsyncStorage.setItem(STORAGE_KEY, value)
  );
  writeQueue = write;
  return write;
}

function migrateLegacyState(state: z.infer<typeof legacySavedStateSchema>): SavedState {
  return {
    version: 2,
    inventory: state.inventory.map(({ status: _status, condition, expiry, ...product }) => ({
      ...product,
      expiry: expiry.trim() || null,
      reorderLevel: null,
      barcode: null,
      barcodeFormat: null,
      condition: condition === 'Needs attention' ? 'Needs attention' : 'Good',
    })),
    activity: state.activity,
  };
}

export function isLowStock(product: Pick<Product, 'quantity' | 'reorderLevel'>) {
  return product.reorderLevel !== null && product.quantity <= product.reorderLevel;
}

export function parseExpiryDate(value: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const namedMatch = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(value.trim());
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let year: number;
  let month: number;
  let day: number;

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]) - 1;
    day = Number(isoMatch[3]);
  } else if (namedMatch) {
    year = Number(namedMatch[3]);
    month = monthNames.indexOf(namedMatch[1].slice(0, 3).toLowerCase());
    day = Number(namedMatch[2]);
  } else {
    return null;
  }

  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function getExpiryStatus(expiry: string | null, now = new Date()): 'Expired' | 'Expiring' | null {
  if (!expiry) {
    return null;
  }
  const expiryDate = parseExpiryDate(expiry);
  if (!expiryDate) {
    return null;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expiryDay = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate()
  ).getTime();
  if (expiryDay < today) {
    return 'Expired';
  }
  if (expiryDay <= today + 7 * 24 * 60 * 60 * 1000) {
    return 'Expiring';
  }
  return null;
}

function sortActivity(activity: ActivityEntry[]) {
  return [...activity].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt) || b.id - a.id
  );
}

function addActivity(
  current: ActivityEntry[],
  entries: ActivityInput[]
): ActivityEntry[] {
  const createdAt = new Date().toISOString();
  const nextId = current.reduce((highest, entry) => Math.max(highest, entry.id), 0);
  const added = entries.map((entry, index) => ({
    ...entry,
    id: nextId + index + 1,
    createdAt,
  }));

  return sortActivity([...added, ...current]);
}

type InventoryState = {
  inventory: Product[];
  activity: ActivityEntry[];
  loadStatus: LoadStatus;
  loadError: string | null;
  saveError: string | null;
  pendingBarcode: ScannedBarcode | null;
  initialize: () => Promise<void>;
  retryInitialization: () => Promise<void>;
  addProduct: (product: ProductInput) => void;
  updateProduct: (id: number, product: ProductInput) => void;
  deleteProduct: (id: number) => void;
  setPendingBarcode: (barcode: ScannedBarcode | null) => void;
  retrySave: () => Promise<void>;
};

export const useInventoryStore = create<InventoryState>((set, get) => {
  let initializePromise: Promise<void> | null = null;

  const persist = async (inventory: Product[], activity: ActivityEntry[]) => {
    try {
      await writeSavedState({ version: 2, inventory, activity });
      set({ saveError: null });
    } catch (error) {
      console.error('Unable to save household inventory.', error);
      set({ saveError: 'Changes could not be saved on this device. Try saving again.' });
    }
  };

  const ensureReady = () => {
    if (get().loadStatus === 'ready') {
      return true;
    }
    console.error('Inventory changes were blocked because saved data is not ready.');
    return false;
  };

  return {
    inventory: initialProducts,
    activity: [],
    loadStatus: 'loading',
    loadError: null,
    saveError: null,
    pendingBarcode: null,

    initialize: () => {
      if (initializePromise) {
        return initializePromise;
      }

      initializePromise = (async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored !== null) {
            const parsed = savedStateSchema.safeParse(JSON.parse(stored));
            if (!parsed.success) {
              throw new Error('Saved household data has an invalid format.');
            }
            set({
              inventory: parsed.data.inventory,
              activity: sortActivity(parsed.data.activity),
              loadStatus: 'ready',
              loadError: null,
            });
            return;
          }

          const legacyStored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacyStored !== null) {
            const legacyParsed = legacySavedStateSchema.safeParse(JSON.parse(legacyStored));
            if (!legacyParsed.success) {
              throw new Error('Saved household data has an invalid format.');
            }
            const migrated = migrateLegacyState(legacyParsed.data);
            await writeSavedState(migrated);
            set({
              inventory: migrated.inventory,
              activity: sortActivity(migrated.activity),
              loadStatus: 'ready',
              loadError: null,
            });
            return;
          }

          const seeded: SavedState = { version: 2, inventory: initialProducts, activity: [] };
          await writeSavedState(seeded);
          set({
            inventory: seeded.inventory,
            activity: [],
            loadStatus: 'ready',
            loadError: null,
          });
        } catch (error) {
          console.error('Unable to restore household inventory; saved data was left untouched.', error);
          set({
            loadStatus: 'error',
            loadError: 'Inventory could not be loaded. Your saved data was not changed.',
          });
        }
      })();

      return initializePromise;
    },

    retryInitialization: async () => {
      initializePromise = null;
      set({ loadStatus: 'loading', loadError: null });
      await get().initialize();
    },

    addProduct: (product) => {
      if (!ensureReady()) {
        return;
      }
      const state = get();
      const id = state.inventory.reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
      const inventory = [{ ...product, id }, ...state.inventory];
      const activity = addActivity(state.activity, [{
        type: 'product-added',
        productName: product.name,
        detail: `Added to ${product.location}`,
      }]);
      set({ inventory, activity, saveError: null });
      void persist(inventory, activity);
    },

    updateProduct: (id, updatedProduct) => {
      if (!ensureReady()) {
        return;
      }
      const state = get();
      const previous = state.inventory.find((product) => product.id === id);
      if (!previous) {
        console.warn(`Ignored an update for missing inventory item ${id}.`);
        return;
      }
      const hasChanged =
        previous.name !== updatedProduct.name ||
        previous.category !== updatedProduct.category ||
        previous.location !== updatedProduct.location ||
        previous.quantity !== updatedProduct.quantity ||
        previous.unit !== updatedProduct.unit ||
        previous.expiry !== updatedProduct.expiry ||
        previous.reorderLevel !== updatedProduct.reorderLevel ||
        previous.barcode !== updatedProduct.barcode ||
        previous.barcodeFormat !== updatedProduct.barcodeFormat ||
        previous.condition !== updatedProduct.condition ||
        previous.icon !== updatedProduct.icon;
      if (!hasChanged) {
        return;
      }

      const inventory = state.inventory.map((product) =>
        product.id === id ? { ...updatedProduct, id } : product
      );
      const changes: ActivityInput[] = [{
        type: 'product-edited',
        productName: updatedProduct.name,
        detail: 'Product details updated',
      }];
      if (previous.quantity !== updatedProduct.quantity) {
        changes.push({
          type: 'quantity-changed',
          productName: updatedProduct.name,
          detail: `Quantity changed from ${previous.quantity} ${previous.unit} to ${updatedProduct.quantity} ${updatedProduct.unit}`,
        });
      }
      if (previous.location !== updatedProduct.location) {
        changes.push({
          type: 'location-changed',
          productName: updatedProduct.name,
          detail: `Moved from ${previous.location} to ${updatedProduct.location}`,
        });
      }
      if (
        previous.reorderLevel !== updatedProduct.reorderLevel ||
        (previous.reorderLevel !== null && previous.unit !== updatedProduct.unit)
      ) {
        const previousLevel = previous.reorderLevel === null
          ? 'not set'
          : `${previous.reorderLevel} ${previous.unit}`;
        const nextLevel = updatedProduct.reorderLevel === null
          ? 'not set'
          : `${updatedProduct.reorderLevel} ${updatedProduct.unit}`;
        changes.push({
          type: 'threshold-changed',
          productName: updatedProduct.name,
          detail: `Minimum stock changed from ${previousLevel} to ${nextLevel}`,
        });
      }
      const activity = addActivity(state.activity, changes);
      set({ inventory, activity, saveError: null });
      void persist(inventory, activity);
    },

    deleteProduct: (id) => {
      if (!ensureReady()) {
        return;
      }
      const state = get();
      const product = state.inventory.find((item) => item.id === id);
      if (!product) {
        console.warn(`Ignored a deletion for missing inventory item ${id}.`);
        return;
      }
      const inventory = state.inventory.filter((item) => item.id !== id);
      const activity = addActivity(state.activity, [{
        type: 'product-deleted',
        productName: product.name,
        detail: 'Removed from inventory',
      }]);
      set({ inventory, activity, saveError: null });
      void persist(inventory, activity);
    },

    setPendingBarcode: (pendingBarcode) => set({ pendingBarcode }),

    retrySave: async () => {
      const state = get();
      if (state.loadStatus === 'ready') {
        await persist(state.inventory, state.activity);
      }
    },
  };
});
