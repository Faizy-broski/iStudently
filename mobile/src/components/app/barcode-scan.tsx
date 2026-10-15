import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

/**
 * Camera barcode/QR scan in a dialog; calls onScan once per opening with the decoded text
 * (the app's stand-in for the web's USB "keyboard wedge" scanners).
 */
export function BarcodeScanDialog({ open, onOpenChange, onScan, title }: { open: boolean; onOpenChange: (o: boolean) => void; onScan: (code: string) => void; title?: string }) {
  const { t } = useTranslation();
  const [perm, request] = useCameraPermissions();
  const done = useRef(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) done.current = false;
        onOpenChange(o);
      }}>
      <DialogContent className="w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t('app.scan_title')}</DialogTitle>
        </DialogHeader>
        {!perm ? null : !perm.granted ? (
          <View className="items-center gap-3 py-6">
            <Text className="text-muted-foreground text-center text-sm">{t('app.scan_permission')}</Text>
            <Button onPress={request}>
              <Text>{t('app.scan_allow')}</Text>
            </Button>
          </View>
        ) : open ? (
          <View className="aspect-square overflow-hidden rounded-lg bg-black">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'pdf417'] }}
              onBarcodeScanned={({ data }) => {
                if (done.current || !data) return;
                done.current = true;
                onOpenChange(false);
                onScan(data.trim());
              }}
            />
          </View>
        ) : null}
        <Text className="text-muted-foreground text-center text-xs">{t('app.scan_hint')}</Text>
      </DialogContent>
    </Dialog>
  );
}
