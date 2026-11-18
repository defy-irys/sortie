import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import type { RetailBarcodeFormat, ScannedBarcode } from '@/stores/inventory-store';

const barcodeFormats = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const satisfies readonly RetailBarcodeFormat[];
const barcodeLengths: Record<RetailBarcodeFormat, number> = {
  ean13: 13,
  ean8: 8,
  upc_a: 12,
  upc_e: 8,
};

function isRetailBarcodeFormat(value: string): value is RetailBarcodeFormat {
  return barcodeFormats.some((format) => format === value);
}

export function BarcodeScannerModal({
  visible,
  onScanned,
  onCancel,
}: {
  visible: boolean;
  onScanned: (barcode: ScannedBarcode) => void;
  onCancel: () => void;
}) {
  const colors = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const handledScan = useRef(false);
  const lastRejectedValue = useRef('');

  const requestCameraAccess = async () => {
    setPermissionError('');
    try {
      const result = await requestPermission();
      if (!result.granted) {
        setPermissionError(
          result.canAskAgain
            ? 'Camera access was not granted. You can try again or enter the barcode manually.'
            : 'Camera access is disabled. Enable it in your device settings, or enter the barcode manually.'
        );
      }
    } catch (error) {
      console.error('Unable to request camera permission.', error);
      setPermissionError('Camera permission could not be requested. Enter the barcode manually instead.');
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (handledScan.current) {
      return;
    }
    if (!isRetailBarcodeFormat(result.type)) {
      if (lastRejectedValue.current !== result.data) {
        lastRejectedValue.current = result.data;
        setScanError('That barcode type is not supported. Try an EAN or UPC product barcode.');
      }
      return;
    }
    if (!/^\d+$/.test(result.data) || result.data.length !== barcodeLengths[result.type]) {
      if (lastRejectedValue.current !== result.data) {
        lastRejectedValue.current = result.data;
        setScanError('The barcode could not be read clearly. Adjust the camera and try again.');
      }
      return;
    }

    handledScan.current = true;
    onScanned({ value: result.data, format: result.type });
  };

  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 58,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: '700' },
    cancelText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    content: { flex: 1, padding: 18, gap: 16 },
    message: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    preview: {
      flex: 1,
      minHeight: 260,
      maxHeight: 640,
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: '#171512',
    },
    camera: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    scanWindow: {
      width: '88%',
      height: 150,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    hint: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 16,
      textShadowColor: '#000000',
      textShadowRadius: 5,
    },
    error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
    primaryButton: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    primaryButtonText: { color: colors.backgroundElement, fontSize: 13, fontWeight: '700' },
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retryText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan barcode</Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Return to product form"
            hitSlop={10}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {permission === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.message}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <Text style={styles.title}>Camera access needed</Text>
            <Text style={styles.message}>
              Sortie uses the camera only to read a product barcode. You can also enter the code manually.
            </Text>
            {permissionError ? <Text style={styles.error}>{permissionError}</Text> : null}
            {permission.canAskAgain ? (
              <Pressable
                onPress={() => { void requestCameraAccess(); }}
                style={styles.primaryButton}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Allow camera access</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onCancel} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryText}>Return to product form</Text>
            </Pressable>
          </View>
        ) : cameraError ? (
          <View style={styles.centered}>
            <Text style={styles.title}>Camera unavailable</Text>
            <Text style={styles.message}>{cameraError}</Text>
            <Pressable
              onPress={() => setCameraError('')}
              style={styles.primaryButton}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Try camera again</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryText}>Return to product form</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.preview}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...barcodeFormats] }}
                onBarcodeScanned={handleBarcodeScanned}
                onMountError={(event) => setCameraError(event.message)}
              />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.scanWindow} />
                <Text style={styles.hint}>Align an EAN-13, EAN-8, UPC-A, or UPC-E barcode</Text>
              </View>
            </View>
            <Text style={scanError ? styles.error : styles.message}>
              {scanError || 'Hold the product steady inside the frame.'}
            </Text>
            <Pressable onPress={onCancel} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryText}>Return to product form</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
