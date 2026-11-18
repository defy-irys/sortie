
import React, { useEffect, useMemo, useState } from 'react';
import { BarcodeScannerModal } from '@/components/barcode-scanner-modal';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/theme-provider';
import {
  getExpiryStatus,
  isLowStock,
  parseExpiryDate,
  useInventoryStore,
  type ActivityType,
  type Product,
  type ProductInput,
  type RetailBarcodeFormat,
  type ScannedBarcode,
} from '@/stores/inventory-store';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Section = 'Overview' | 'Inventory' | 'Locations' | 'Activity' | 'Settings';

type ProductDraft = {
  name: string;
  category: string;
  location: string;
  quantity: string;
  unit: string;
  expiry: string;
  reorderLevel: string;
  barcode: string;
  barcodeFormat: RetailBarcodeFormat | null;
  condition: Product['condition'];
};

const locations = [
  { name: 'Refrigerator', icon: '❄', detail: 'Keep fresh food chilled', note: 'Cool storage' },
  { name: 'Pantry', icon: '▤', detail: 'Dry goods and everyday staples', note: 'Dry storage' },
  { name: 'Freezer', icon: '◈', detail: 'Long-term frozen storage', note: 'Frozen storage' },
];

const categories = ['Dairy', 'Grains', 'Meat', 'Beverages', 'Condiments', 'Produce', 'Other'];
const productLocations = ['Refrigerator', 'Pantry', 'Freezer'];
const conditions: Product['condition'][] = ['Good', 'Needs attention'];

const activityPresentation: Record<ActivityType, { icon: string; title: string }> = {
  'product-added': { icon: '+', title: 'Product added' },
  'product-edited': { icon: '✎', title: 'Product edited' },
  'product-deleted': { icon: '−', title: 'Product deleted' },
  'quantity-changed': { icon: '↻', title: 'Quantity updated' },
  'location-changed': { icon: '→', title: 'Item moved' },
  'threshold-changed': { icon: '!', title: 'Minimum stock changed' },
};

function emptyDraft(): ProductDraft {
  return {
    name: '',
    category: categories[0],
    location: productLocations[0],
    quantity: '1',
    unit: 'pcs',
    expiry: '',
    reorderLevel: '',
    barcode: '',
    barcodeFormat: null,
    condition: 'Good',
  };
}

const navigation: { name: Section; icon: string }[] = [
  { name: 'Overview', icon: '⌂' },
  { name: 'Inventory', icon: '▦' },
  { name: 'Locations', icon: '⌖' },
  { name: 'Activity', icon: '↗' },
];

function Label({
  children,
  styles,
}: {
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return <Text style={styles.label}>{children}</Text>;
}

function Metric({
  title,
  value,
  subtitle,
  icon,
  accent,
  styles,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  accent: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text style={[styles.metricIcon, { color: accent }]}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Status({
  status,
  styles,
  colors,
}: {
  status: 'Low stock' | 'Expiring' | 'Expired' | 'Needs attention';
  styles: ReturnType<typeof createStyles>;
  colors: {
    amber: string;
    amberLight: string;
    red: string;
    redLight: string;
  };
}) {
  const isStockOrCondition = status === 'Low stock' || status === 'Needs attention';
  const color = isStockOrCondition ? colors.amber : colors.red;
  const background = isStockOrCondition ? colors.amberLight : colors.redLight;

  return (
    <View style={[styles.status, { backgroundColor: background }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{status}</Text>
    </View>
  );
}

function Sidebar({
  active,
  onSelect,
  styles,
}: {
  active: Section;
  onSelect: (section: Section) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>S</Text>
        </View>
        <View>
          <Text style={styles.brandName}>sortie</Text>
          <Text style={styles.brandSubtitle}>HOUSEHOLD INVENTORY</Text>
        </View>
      </View>

      <Text style={styles.navHeading}>WORKSPACE</Text>

      {navigation.map((item) => {
        const selected = active === item.name;

        return (
          <Pressable
            key={item.name}
            onPress={() => onSelect(item.name)}
            style={[styles.navItem, selected && styles.navItemActive]}
          >
            <Text style={[styles.navIcon, selected && styles.navTextActive]}>
              {item.icon}
            </Text>
            <Text style={[styles.navText, selected && styles.navTextActive]}>
              {item.name}
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.sidebarSpacer} />

      <View style={styles.householdCard}>
        <Text style={styles.householdLabel}>HOUSEHOLD</Text>
        <Text style={styles.householdName}>My Household</Text>
        <Text style={styles.householdHint}>Your private inventory</Text>
      </View>

      <Pressable
        onPress={() => onSelect('Settings')}
        style={[styles.navItem, active === 'Settings' && styles.navItemActive]}
      >
        <Text style={styles.navIcon}>⚙</Text>
        <Text style={[styles.navText, active === 'Settings' && styles.navTextActive]}>
          Settings
        </Text>
      </Pressable>

      <Text style={styles.version}>SORTIE · VERSION 1.0</Text>
    </View>
  );
}

function ProductRow({
  product,
  styles,
  colors,
  onEdit,
}: {
  product: Product;
  styles: ReturnType<typeof createStyles>;
  onEdit?: () => void;
  colors: {
    green: string;
    greenLight: string;
    amber: string;
    amberLight: string;
    red: string;
    redLight: string;
  };
}) {
  const expiryStatus = getExpiryStatus(product.expiry);
  const alerts = [
    isLowStock(product) ? 'Low stock' : null,
    expiryStatus,
    product.condition === 'Needs attention' ? 'Needs attention' : null,
  ].filter((status): status is 'Low stock' | 'Expiring' | 'Expired' | 'Needs attention' => status !== null);

  return (
    <View style={styles.productRow}>
      <View style={styles.productIcon}>
        <Text style={{ fontSize: 23 }}>{product.icon}</Text>
      </View>

        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.productInfo} accessibilityRole="button">
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productMeta}>
              {product.category} · {product.location}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productMeta}>
              {product.category} · {product.location}
            </Text>
          </View>
        )}

      <View style={styles.quantityColumn}>
        <Text style={styles.quantityValue}>{product.quantity}</Text>
        <Text style={styles.quantityUnit}>{product.unit}</Text>
      </View>

      <View style={styles.productStatus}>
        {alerts.map((status) => (
          <Status key={status} status={status} styles={styles} colors={colors} />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const colors = useTheme();
  const { preference, setPreference } = useThemePreference();

  const C = useMemo(() => ({
    background: colors.background,
    surface: colors.backgroundElement,
    sidebar: colors.backgroundElement,
    text: colors.text,
    muted: colors.textSecondary,
    border: colors.border,
    green: colors.success,
    greenLight: colors.backgroundSelected,
    amber: colors.warning,
    amberLight: colors.warningBackground,
    red: colors.danger,
    redLight: colors.dangerBackground,
    dark: colors.primaryDark,
  }), [colors]);
  const compact = width < 430;
  const styles = useMemo(() => createStyles(C, compact), [C, compact]);
  const wide = width >= 850;

  const [active, setActive] = useState<Section>('Overview');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const inventory = useInventoryStore((state) => state.inventory);
  const activity = useInventoryStore((state) => state.activity);
  const loadStatus = useInventoryStore((state) => state.loadStatus);
  const loadError = useInventoryStore((state) => state.loadError);
  const saveError = useInventoryStore((state) => state.saveError);
  const initialize = useInventoryStore((state) => state.initialize);
  const retryInitialization = useInventoryStore((state) => state.retryInitialization);
  const addProduct = useInventoryStore((state) => state.addProduct);
  const updateProduct = useInventoryStore((state) => state.updateProduct);
  const deleteProduct = useInventoryStore((state) => state.deleteProduct);
  const retrySave = useInventoryStore((state) => state.retrySave);
  const [formVisible, setFormVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const filteredProducts = useMemo(() => {
    return inventory.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'All' || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, query, category]);
  const expiringProducts = inventory.filter(
    (product) => getExpiryStatus(product.expiry) === 'Expiring'
  );
  const lowStockCount = inventory.filter(isLowStock).length;

  const openAddForm = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError('');
    setConfirmDelete(false);
    setFormVisible(true);
  };

  const openEditForm = (product: Product) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      category: product.category,
      location: product.location,
      quantity: String(product.quantity),
      unit: product.unit,
      expiry: product.expiry ?? '',
      reorderLevel: product.reorderLevel === null ? '' : String(product.reorderLevel),
      barcode: product.barcode ?? '',
      barcodeFormat: product.barcodeFormat,
      condition: product.condition,
    });
    setFormError('');
    setConfirmDelete(false);
    setFormVisible(true);
  };

  const saveProduct = () => {
    const name = draft.name.trim();
    const quantity = Number(draft.quantity);
    const unit = draft.unit.trim();
    if (!name || !unit || !Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Enter a product name, unit, and quantity greater than zero.');
      return;
    }

    const expiry = draft.expiry.trim();
    if (expiry && !parseExpiryDate(expiry)) {
      setFormError('Enter a valid date (YYYY-MM-DD or e.g. Dec 31, 2026), or leave blank.');
      return;
    }

    const reorderLevelText = draft.reorderLevel.trim();
    const reorderLevel = reorderLevelText === '' ? null : Number(reorderLevelText);
    if (reorderLevel !== null && (!Number.isFinite(reorderLevel) || reorderLevel < 0)) {
      setFormError('Minimum stock must be zero or a positive number.');
      return;
    }

    const barcode = draft.barcode.trim();
    const barcodeLengths: Record<RetailBarcodeFormat, number> = {
      ean13: 13,
      ean8: 8,
      upc_a: 12,
      upc_e: 8,
    };
    if (barcode && (!/^\d+$/.test(barcode) || ![8, 12, 13].includes(barcode.length))) {
      setFormError('Enter a numeric EAN or UPC barcode (8, 12, or 13 digits).');
      return;
    }
    if (barcode && draft.barcodeFormat && barcode.length !== barcodeLengths[draft.barcodeFormat]) {
      setFormError('The barcode length does not match its scanned format.');
      return;
    }

    const iconByCategory: Record<string, string> = {
      Dairy: '🥛',
      Grains: '🍚',
      Meat: '🍗',
      Beverages: '🧃',
      Condiments: '🫒',
      Produce: '🥬',
      Other: '📦',
    };

    const product: ProductInput = {
      ...draft,
      name,
      quantity,
      unit,
      expiry: expiry || null,
      reorderLevel,
      barcode: barcode || null,
      barcodeFormat: barcode ? draft.barcodeFormat : null,
      icon: iconByCategory[draft.category] ?? '📦',
    };

    if (editingId === null) {
      addProduct(product);
    } else {
      updateProduct(editingId, product);
    }
    setFormVisible(false);
  };

  const openBarcodeScanner = () => {
    setFormVisible(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = (barcode: ScannedBarcode) => {
    setDraft((current) => ({
      ...current,
      barcode: barcode.value,
      barcodeFormat: barcode.format,
    }));
    setFormError('');
    setScannerVisible(false);
    setFormVisible(true);
  };

  const cancelBarcodeScan = () => {
    setScannerVisible(false);
    setFormVisible(true);
  };

  const changePreference = (value: 'system' | 'light' | 'dark') => {
    setPreferenceError('');
    void setPreference(value).catch(() => {
      setPreferenceError('Could not save your appearance preference. Please try again.');
    });
  };

  const changeSection = (section: Section) => {
    setActive(section);
    setQuery('');
  };

  if (loadStatus !== 'ready') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadState}>
          <Text style={styles.welcomeTitle}>
            {loadStatus === 'loading' ? 'Loading your inventory…' : 'Inventory unavailable'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {loadError ?? 'Your saved household data is being restored.'}
          </Text>
          {loadStatus === 'error' ? (
            <Pressable
              onPress={() => { void retryInitialization(); }}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.app}>
        {wide && (
          <Sidebar
            active={active}
            onSelect={changeSection}
            styles={styles}
          />
          )}

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.topbarEyebrow}>MY HOUSEHOLD</Text>
              <Text style={styles.topbarTitle}>{active}</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>H</Text>
            </View>
          </View>

          {!wide && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileNav}
            >
              {[...navigation, { name: 'Settings' as Section, icon: '⚙' }].map((item) => (
                <Pressable
                  key={item.name}
                  onPress={() => changeSection(item.name)}
                  style={[styles.mobileNavItem, active === item.name && styles.mobileNavActive]}
                >
                  <Text style={[styles.mobileNavText, active === item.name && styles.navTextActive]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {saveError ? (
              <View style={styles.saveNotice}>
                <Text style={styles.saveNoticeText}>{saveError}</Text>
                <Pressable onPress={() => { void retrySave(); }} accessibilityRole="button">
                  <Text style={styles.saveNoticeAction}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {active === 'Overview' && (
              <>
                <View style={styles.welcome}>
                  <View>
                    <Text style={styles.welcomeTitle}>Good to see you.</Text>
                    <Text style={styles.welcomeSubtitle}>
                      Here&apos;s what&apos;s happening around your household.
                    </Text>
                  </View>
                  <Text style={styles.dateText}>NOVEMBER 17, 2026</Text>
                </View>

                <View style={styles.metrics}>
                  <Metric title="Total products" value={String(inventory.length).padStart(2, '0')} subtitle="Across your household" icon="▦" accent={C.green} styles={styles} />
                  <Metric title="Low stock" value={String(lowStockCount).padStart(2, '0')} subtitle="At or below minimum stock" icon="!" accent={C.amber} styles={styles} />
                  <Metric title="Expiring soon" value={String(expiringProducts.length).padStart(2, '0')} subtitle="Within the next 7 days" icon="◷" accent={C.red} styles={styles} />
                </View>

                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>Inventory overview</Text>
                    <Text style={styles.sectionSubtitle}>A look at your household stock.</Text>
                  </View>
                  <Pressable onPress={() => changeSection('Inventory')}>
                    <Text style={styles.actionText}>View inventory →</Text>
                  </Pressable>
                </View>

                <View style={styles.inventoryCard}>
                  <View style={styles.tableHeader}>
                    <Label styles={styles}>PRODUCT</Label>
                    <Label styles={styles}>QUANTITY</Label>
                    <Label styles={styles}>STATUS</Label>
                  </View>

                  {inventory.slice(0, 5).map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      styles={styles}
                      colors={C}
                    />
                  ))}
                </View>

                <View style={styles.bottomGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Expiring soon</Text>
                    <Text style={styles.infoDescription}>Keep an eye on these items.</Text>
                    {expiringProducts.map((p) => (
                      <View key={p.id} style={styles.expiryItem}>
                        <Text style={{ fontSize: 21 }}>{p.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expiryName}>{p.name}</Text>
                          <Text style={styles.expiryDate}>{p.expiry}</Text>
                        </View>
                        <Text style={styles.expiryArrow}>›</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Storage locations</Text>
                    <Text style={styles.infoDescription}>Your inventory, organized.</Text>
                    {locations.map(({ icon, name }) => (
                      <View key={name} style={styles.locationItem}>
                        <Text style={styles.locationIcon}>{icon}</Text>
                        <Text style={styles.locationName}>{name}</Text>
                        <Text style={styles.locationCount}>
                          {inventory.filter((product) => product.location === name).length} items
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {active === 'Inventory' && (
              <>
                <View style={styles.welcome}>
                  <View>
                    <Text style={styles.welcomeTitle}>Your inventory.</Text>
                    <Text style={styles.welcomeSubtitle}>Manage everything in your household.</Text>
                  </View>
                  <Pressable onPress={openAddForm} style={styles.addButton}>
                    <Text style={styles.addButtonText}>＋ Add product</Text>
                  </Pressable>
                </View>

                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>⌕</Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search your inventory..."
                    placeholderTextColor={C.muted}
                    style={styles.searchInput}
                  />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                  {['All', ...categories].map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      style={[styles.filter, category === item && styles.filterActive]}
                    >
                      <Text style={[styles.filterText, category === item && styles.filterTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.inventoryCard}>
                  {filteredProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      styles={styles}
                      colors={C}
                      onEdit={() => openEditForm(product)}
                    />
                  ))}
                  {filteredProducts.length === 0 && (
                    <Text style={styles.emptyText}>No matching products found.</Text>
                  )}
                </View>
              </>
            )}

            {active === 'Settings' && (
              <View>
                <View style={styles.welcome}>
                  <View>
                    <Text style={styles.welcomeTitle}>Settings.</Text>
                    <Text style={styles.welcomeSubtitle}>
                      Customize your Sortie experience.
                    </Text>
                  </View>
                </View>

                <View style={styles.settingsCard}>
                  <Text style={styles.settingsTitle}>Appearance</Text>
                  <Text style={styles.settingsDescription}>
                    Choose how Sortie looks on your device.
                  </Text>

                  {([
                    {
                      value: 'system',
                      title: 'System',
                      description: 'Follow your device appearance.',
                      icon: '◐',
                    },
                    {
                      value: 'light',
                      title: 'Light',
                      description: 'Use the light color scheme.',
                      icon: '☀',
                    },
                    {
                      value: 'dark',
                      title: 'Dark',
                      description: 'Use the dark color scheme.',
                      icon: '☾',
                    },
                  ] as const).map((option) => {
                    const selected = preference === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => changePreference(option.value)}
                        style={[
                          styles.appearanceOption,
                          selected && styles.appearanceOptionSelected,
                        ]}
                      >
                        <Text style={styles.appearanceIcon}>{option.icon}</Text>

                        <View style={styles.appearanceInfo}>
                          <Text style={styles.appearanceName}>{option.title}</Text>
                          <Text style={styles.appearanceDescription}>
                            {option.description}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.radioOuter,
                            selected && styles.radioOuterSelected,
                          ]}
                        >
                          {selected && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                  {preferenceError ? (
                    <Text style={styles.formError}>{preferenceError}</Text>
                  ) : null}
                </View>
              </View>
            )}
            {active === 'Locations' && (
              <>
                <View style={styles.welcome}>
                  <View>
                    <Text style={styles.welcomeTitle}>Storage locations.</Text>
                    <Text style={styles.welcomeSubtitle}>See what you keep in each space.</Text>
                  </View>
                </View>
                <View style={styles.locationGrid}>
                  {locations.map((location) => {
                    const storedProducts = inventory.filter(
                      (product) => product.location === location.name
                    );
                    return (
                      <View key={location.name} style={styles.locationCard}>
                        <View style={styles.locationCardHeader}>
                          <Text style={styles.locationCardIcon}>{location.icon}</Text>
                          <Text style={styles.locationCountBadge}>
                            {storedProducts.length} {storedProducts.length === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                        <Text style={styles.locationCardTitle}>{location.name}</Text>
                        <Text style={styles.locationCardDetail}>{location.detail}</Text>
                        <Text style={styles.locationNote}>{location.note}</Text>
                        {storedProducts.length > 0 ? storedProducts.map((product) => (
                          <View key={product.id} style={styles.locationProduct}>
                            <Text style={styles.locationProductIcon}>{product.icon}</Text>
                            <Text style={styles.locationProductName}>{product.name}</Text>
                            <Text style={styles.locationProductQuantity}>
                              {product.quantity} {product.unit}
                            </Text>
                          </View>
                        )) : (
                          <Text style={styles.locationEmpty}>No items stored here yet.</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {active === 'Activity' && (
              <View>
                <View style={styles.welcome}>
                  <View>
                    <Text style={styles.welcomeTitle}>Recent activity.</Text>
                    <Text style={styles.welcomeSubtitle}>
                      A timeline of household inventory changes.
                    </Text>
                  </View>
                </View>
                <View style={styles.activityCard}>
                  {activity.length === 0 ? (
                    <Text style={styles.emptyText}>Inventory changes will appear here.</Text>
                  ) : activity.map((item, index) => {
                    const presentation = activityPresentation[item.type];
                    return (
                      <View key={item.id} style={styles.activityItem}>
                        <View style={styles.activityIcon}>
                          <Text style={styles.activityIconText}>{presentation.icon}</Text>
                        </View>
                        <View style={styles.activityInfo}>
                          <Text style={styles.activityTitle}>{presentation.title}</Text>
                          <Text style={styles.activityDetail}>
                            {item.productName} · {item.detail}
                          </Text>
                          <Text style={styles.activityDate}>
                            {new Date(item.createdAt).toLocaleString()}
                          </Text>
                        </View>
                        {index < activity.length - 1 ? (
                          <View style={styles.activityConnector} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={styles.footer}>SORTIE · YOUR HOUSEHOLD, IN ORDER.</Text>
          </ScrollView>
        </View>
      </View>
      <Modal
        visible={formVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formTitle}>
                {editingId === null ? 'Add product' : 'Edit product'}
              </Text>
              <Text style={styles.formDescription}>
                Keep a quick record of what you have at home.
              </Text>

              <Text style={styles.fieldLabel}>Product name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                placeholder="e.g. Rolled oats"
                placeholderTextColor={C.muted}
                style={styles.formInput}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Barcode (optional)</Text>
              <View style={styles.barcodeEntry}>
                <TextInput
                  value={draft.barcode}
                  onChangeText={(barcode) => setDraft((current) => ({
                    ...current,
                    barcode,
                    barcodeFormat: null,
                  }))}
                  keyboardType="number-pad"
                  placeholder="8, 12, or 13 digits"
                  placeholderTextColor={C.muted}
                  style={[styles.formInput, styles.barcodeInput]}
                  maxLength={13}
                  accessibilityLabel="Product barcode"
                />
                <Pressable
                  onPress={openBarcodeScanner}
                  style={styles.scanButton}
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode with camera"
                >
                  <Text style={styles.scanButtonText}>Scan</Text>
                </Pressable>
              </View>
              {draft.barcodeFormat ? (
                <Text style={styles.formHint}>Scanned as {draft.barcodeFormat.toUpperCase()}</Text>
              ) : (
                <Text style={styles.formHint}>A barcode does not fill in product details automatically.</Text>
              )}

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.choiceRow}>
                {categories.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setDraft((current) => ({ ...current, category: option }))}
                    style={[styles.choice, draft.category === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, draft.category === option && styles.choiceTextSelected]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput
                    value={draft.quantity}
                    onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={C.muted}
                    style={styles.formInput}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    value={draft.unit}
                    onChangeText={(unit) => setDraft((current) => ({ ...current, unit }))}
                    placeholder="pcs"
                    placeholderTextColor={C.muted}
                    style={styles.formInput}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>
                Minimum stock level ({draft.unit.trim() || 'unit'})
              </Text>
              <TextInput
                value={draft.reorderLevel}
                onChangeText={(reorderLevel) => setDraft((current) => ({ ...current, reorderLevel }))}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor={C.muted}
                style={styles.formInput}
                accessibilityLabel="Minimum stock level"
              />
              <Text style={styles.formHint}>
                Leave blank if you do not use a reorder level. Alert applies at or below this amount.
              </Text>

              <Text style={styles.fieldLabel}>Storage location</Text>
              <View style={styles.choiceRow}>
                {productLocations.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setDraft((current) => ({ ...current, location: option }))}
                    style={[styles.choice, draft.location === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, draft.location === option && styles.choiceTextSelected]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Expiry date</Text>
              <TextInput
                value={draft.expiry}
                onChangeText={(expiry) => setDraft((current) => ({ ...current, expiry }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.muted}
                style={styles.formInput}
              />

              <Text style={styles.fieldLabel}>Condition</Text>
              <View style={styles.choiceRow}>
                {conditions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setDraft((current) => ({ ...current, condition: option }))}
                    style={[styles.choice, draft.condition === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, draft.condition === option && styles.choiceTextSelected]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              {confirmDelete ? (
                <View style={styles.deleteConfirmation}>
                  <Text style={styles.formError}>Remove this product from inventory?</Text>
                  <View style={styles.formActions}>
                    <Pressable onPress={() => setConfirmDelete(false)} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Keep product</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (editingId !== null) {
                          deleteProduct(editingId);
                        }
                        setFormVisible(false);
                      }}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {!confirmDelete ? (
                <View style={styles.formActions}>
                  {editingId !== null ? (
                    <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>Remove</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.formActionSpacer} />
                  <Pressable onPress={() => setFormVisible(false)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={saveProduct} style={styles.addButton}>
                    <Text style={styles.addButtonText}>
                      {editingId === null ? 'Add product' : 'Save changes'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {scannerVisible ? (
        <BarcodeScannerModal
          visible
          onScanned={handleBarcodeScanned}
          onCancel={cancelBarcodeScan}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (C: {
  background: string;
  surface: string;
  sidebar: string;
  text: string;
  muted: string;
  border: string;
  green: string;
  greenLight: string;
  amber: string;
  amberLight: string;
  red: string;
  redLight: string;
  dark: string;
}, compact: boolean) => StyleSheet.create({

  root: { flex: 1, backgroundColor: C.background },
  loadState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  saveNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, marginBottom: 16, borderRadius: 9, backgroundColor: C.redLight },
  saveNoticeText: { flex: 1, color: C.red, fontSize: 11 },
  saveNoticeAction: { color: C.red, fontSize: 11, fontWeight: '700' },
  app: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 248,
    backgroundColor: C.sidebar,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 18,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 54 },
  brandMark: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center',
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700' },
  brandName: { fontSize: 23, fontWeight: '700', color: C.text, letterSpacing: -1 },
  brandSubtitle: { fontSize: 8, fontWeight: '700', color: C.muted, letterSpacing: 1.2, marginTop: 2 },
  navHeading: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.4, marginBottom: 14, marginLeft: 10 },
  navItem: {
    height: 46, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, gap: 13, marginBottom: 5,
  },
  navItemActive: { backgroundColor: C.greenLight },
  navIcon: { fontSize: 21, color: C.muted, width: 24, textAlign: 'center' },
  navText: { color: C.muted, fontSize: 14, fontWeight: '500' },
  navTextActive: { color: C.green, fontWeight: '700' },
  sidebarSpacer: { flex: 1 },
  householdCard: { backgroundColor: C.greenLight, borderRadius: 12, padding: 15, marginBottom: 14 },
  householdLabel: { fontSize: 9, color: C.muted, fontWeight: '700', letterSpacing: 1.2 },
  householdName: { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 8 },
  householdHint: { fontSize: 11, color: C.muted, marginTop: 3 },
  version: { color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 17, marginLeft: 10 },
  main: { flex: 1, minWidth: 0 },
  topbar: {
    height: 76, paddingHorizontal: compact ? 18 : 34, borderBottomWidth: 1,
    borderBottomColor: C.border, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface,
  },
  topbarEyebrow: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  topbarTitle: { fontSize: 19, fontWeight: '700', color: C.text, marginTop: 3 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: C.green, fontSize: 14 },
  mobileNav: { paddingHorizontal: 18, paddingVertical: 12, gap: 8 },
  mobileNavItem: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, backgroundColor: C.surface },
  mobileNavActive: { backgroundColor: C.greenLight },
  mobileNavText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  contentScroll: { flex: 1 },
  content: { paddingHorizontal: compact ? 18 : 34, paddingTop: compact ? 22 : 32, paddingBottom: 50, maxWidth: 1250, width: '100%', alignSelf: 'center' },
  welcome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 27 },
  welcomeTitle: { color: C.text, fontSize: compact ? 23 : 27, fontWeight: '700', letterSpacing: -0.8 },
  welcomeSubtitle: { color: C.muted, fontSize: 13, marginTop: 7 },
  dateText: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, marginBottom: 37 },
  metric: { flexGrow: 1, flexBasis: 175, backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.border, padding: 18, minHeight: 126 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricTitle: { color: C.muted, fontSize: 11, fontWeight: '600' },
  metricIcon: { fontSize: 20, fontWeight: '700' },
  metricValue: { color: C.text, fontSize: 28, fontWeight: '700', marginTop: 13, letterSpacing: -1 },
  metricSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: C.muted, fontSize: 11, marginTop: 4 },
  actionText: { color: C.green, fontSize: 12, fontWeight: '700' },
  inventoryCard: { backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.border, paddingHorizontal: 17, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  productRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, gap: compact ? 7 : 12 },
  productIcon: { width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: 11, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { color: C.text, fontSize: 12, fontWeight: '700' },
  productMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  quantityColumn: { width: compact ? 38 : 60, alignItems: 'center' },
  quantityValue: { color: C.text, fontSize: 13, fontWeight: '700' },
  quantityUnit: { color: C.muted, fontSize: 9, marginTop: 2 },
  productStatus: { width: compact ? 108 : 128, alignItems: 'flex-end', gap: 4 },
  status: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  bottomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 22 },
  infoCard: { flex: 1, flexBasis: 270, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 18 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  infoDescription: { fontSize: 10, color: C.muted, marginTop: 5, marginBottom: 12 },
  expiryItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.border },
  expiryName: { fontSize: 11, fontWeight: '700', color: C.text },
  expiryDate: { fontSize: 10, color: C.red, marginTop: 4 },
  expiryArrow: { color: C.muted, fontSize: 21 },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  locationIcon: { color: C.green, fontSize: 17, width: 25 },
  locationName: { color: C.text, fontSize: 11, fontWeight: '600', flex: 1 },
  locationCount: { color: C.muted, fontSize: 10 },
  footer: { height: 46, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 13, marginTop: 22, marginBottom: 14, color: C.muted, fontSize: 9, letterSpacing: 1 },
  searchBox: { minHeight: 46, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { fontSize: 23, color: C.muted, marginRight: 9 },
  searchInput: { flex: 1, fontSize: 12, color: C.text, outlineStyle: 'none' } as any,
  filters: { gap: 8, paddingBottom: 18 },
  filter: { borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 14 },
  filterActive: { backgroundColor: C.dark, borderColor: C.dark },
  filterText: { color: C.muted, fontSize: 10, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  emptyText: { padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 },
  addButton: { backgroundColor: C.green, paddingVertical: 11, paddingHorizontal: 15, borderRadius: 9 },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  settingsCard: {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 13,
  padding: 20,
  maxWidth: 650,
},
settingsTitle: {
  color: C.text,
  fontSize: 16,
  fontWeight: '700',
},
settingsDescription: {
  color: C.muted,
  fontSize: 11,
  marginTop: 5,
  marginBottom: 18,
},
appearanceOption: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 14,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: C.border,
  marginTop: 9,
  gap: 13,
},
appearanceOptionSelected: {
  borderColor: C.green,
  backgroundColor: C.greenLight,
},
appearanceIcon: {
  fontSize: 22,
  color: C.green,
  width: 28,
  textAlign: 'center',
},
appearanceInfo: {
  flex: 1,
},
appearanceName: {
  color: C.text,
  fontSize: 12,
  fontWeight: '700',
},
appearanceDescription: {
  color: C.muted,
  fontSize: 10,
  marginTop: 4,
},
radioOuter: {
  width: 18,
  height: 18,
  borderRadius: 9,
  borderWidth: 1.5,
  borderColor: C.muted,
  alignItems: 'center',
  justifyContent: 'center',
},
radioOuterSelected: {
  borderColor: C.green,
},
radioInner: {
  width: 9,
  height: 9,
  borderRadius: 5,
  backgroundColor: C.green,
},
  locationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  locationCard: { flex: 1, flexBasis: compact ? 250 : 310, backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.border, padding: 18 },
  locationCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  locationCardIcon: { color: C.green, fontSize: 25 },
  locationCountBadge: { color: C.green, backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, fontSize: 10, fontWeight: '700' },
  locationCardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  locationCardDetail: { color: C.muted, fontSize: 11, marginTop: 5, marginBottom: 9 },
  locationNote: { color: C.green, fontSize: 10, fontWeight: '700', marginBottom: 12 },
  locationProduct: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10, gap: 9 },
  locationProductIcon: { fontSize: 17 },
  locationProductName: { flex: 1, color: C.text, fontSize: 11, fontWeight: '600' },
  locationProductQuantity: { color: C.muted, fontSize: 10 },
  locationEmpty: { color: C.muted, fontSize: 11, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  activityCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 18 },
  activityItem: { flexDirection: 'row', gap: 14, paddingVertical: 17, position: 'relative' },
  activityIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  activityIconText: { color: C.green, fontSize: 17, fontWeight: '700' },
  activityInfo: { flex: 1, paddingTop: 2 },
  activityTitle: { color: C.text, fontSize: 12, fontWeight: '700' },
  activityDetail: { color: C.muted, fontSize: 11, marginTop: 4 },
  activityDate: { color: C.muted, fontSize: 9, marginTop: 6 },
  activityConnector: { position: 'absolute', width: 1, backgroundColor: C.border, top: 50, bottom: -1, left: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: compact ? 12 : 24, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  formCard: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: C.background, borderRadius: 16, overflow: 'hidden' },
  formContent: { padding: compact ? 18 : 24, paddingBottom: 28 },
  formTitle: { color: C.text, fontSize: 22, fontWeight: '700' },
  formDescription: { color: C.muted, fontSize: 12, marginTop: 5, marginBottom: 18 },
  fieldLabel: { color: C.text, fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  formInput: { minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 9, backgroundColor: C.surface, color: C.text, paddingHorizontal: 12, fontSize: 12 },
  barcodeEntry: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barcodeInput: { flex: 1 },
  scanButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 9, backgroundColor: C.green },
  scanButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  formHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  choiceSelected: { borderColor: C.green, backgroundColor: C.greenLight },
  choiceText: { color: C.muted, fontSize: 10, fontWeight: '600' },
  choiceTextSelected: { color: C.green, fontWeight: '700' },
  formError: { color: C.red, fontSize: 11, marginTop: 12 },
  deleteConfirmation: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 4 },
  formActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 22 },
  formActionSpacer: { flex: 1 },
  secondaryButton: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: C.border },
  secondaryButtonText: { color: C.text, fontSize: 11, fontWeight: '600' },
  deleteButton: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 9, backgroundColor: C.redLight },
  deleteButtonText: { color: C.red, fontSize: 11, fontWeight: '700' },
});
