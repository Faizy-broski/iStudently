import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Record a voice note (m4a) and hand back the file; needs the expo-audio native module. */
export default function VoiceRecorder({ onDone, disabled }: { onDone: (file: { uri: string; name: string; type: string }) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  async function start() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return toast.error(t('app.in_mic_permission'));
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (uri) onDone({ uri, name: `voice-note-${Date.now()}.m4a`, type: 'audio/mp4' });
  }

  const secs = Math.floor((state.durationMillis ?? 0) / 1000);
  return state.isRecording ? (
    <View className="flex-row items-center gap-2">
      <Button size="sm" variant="destructive" onPress={stop}>
        <Icon as={Square} className="size-4 text-white" />
        <Text className="text-white">{t('app.in_stop_recording')}</Text>
      </Button>
      <Text className="text-sm text-destructive">{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>
    </View>
  ) : (
    <Button size="sm" variant="outline" onPress={start} disabled={disabled}>
      <Icon as={Mic} className="size-4" />
      <Text>{t('app.in_record_voice')}</Text>
    </Button>
  );
}
