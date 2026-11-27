/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Loading, Modal, Select, Switch } from "@ds";
import { API_BASE } from "@constants";
import { authHeaders } from "@utils";

const label = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export const NarrationSettingsModal = ({ open, onClose, onStart, busy, disabled, initialSettings }) => {
  const [options, setOptions] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const submitted = useRef(false);
  const samplePlayer = useRef(null);
  const activeSamplePlayer = useRef(null);
  const sampleRequest = useRef(null);
  const sampleObjectUrl = useRef(null);
  const [sampleStatus, setSampleStatus] = useState("");
  const [sampleVoice, setSampleVoice] = useState("");
  const stopSample = useCallback(() => {
    sampleRequest.current?.abort();
    sampleRequest.current = null;
    const player = activeSamplePlayer.current || samplePlayer.current;
    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    activeSamplePlayer.current = null;
    if (sampleObjectUrl.current) URL.revokeObjectURL(sampleObjectUrl.current);
    sampleObjectUrl.current = null;
  }, []);

  useEffect(() => {
    if (!open || busy) {
      stopSample();
      setSampleStatus("");
      setSampleVoice("");
    }
    return stopSample;
  }, [open, busy, stopSample]);

  const chooseVoice = async (voice) => {
    setSettings((current) => ({ ...current, voice }));
    stopSample();
    setVoiceError("");
    if (!voice) {
      setSampleVoice("");
      setSampleStatus("");
      return;
    }
    setSampleVoice(voice);
    setSampleStatus("Loading voice sample…");
    const controller = new AbortController();
    sampleRequest.current = controller;
    try {
      const response = await fetch(`${API_BASE}/narration-voices/${encodeURIComponent(voice)}/sample`, { headers: authHeaders(null), signal: controller.signal });
      if (!response.ok) throw new Error("Voice sample is unavailable. Try selecting the voice again.");
      const blob = await response.blob();
      if (controller.signal.aborted || !samplePlayer.current) return;
      const objectUrl = URL.createObjectURL(blob);
      sampleObjectUrl.current = objectUrl;
      activeSamplePlayer.current = samplePlayer.current;
      samplePlayer.current.src = objectUrl;
      try {
        await samplePlayer.current.play();
        if (!controller.signal.aborted) setSampleStatus(`Playing ${label(voice)} sample`);
      } catch {
        if (!controller.signal.aborted) setSampleStatus("Select the voice again to retry its sample.");
      }
    } catch (err) {
      if (!controller.signal.aborted) setSampleStatus(err.message);
    }
  };
  const previousSettings = useRef(initialSettings);
  previousSettings.current = initialSettings;

  useEffect(() => {
    if (!open) return;
    submitted.current = false;
    setOptions(null);
    setSettings(null);
    setError("");
    setVoiceError("");
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/narration-settings`, { headers: authHeaders(), signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.errors || "Could not load narration settings");
        const data = result.data;
        if (!Array.isArray(data.voices) || !data.voices.length || !Array.isArray(data.languages) || !data.defaults) throw new Error("Tangereen returned invalid narration settings");
        const previous = previousSettings.current || data.defaults;
        setOptions(data);
        setSettings({
          voice: data.voices.includes(previous.voice) ? previous.voice : data.defaults.voice,
          language: data.languages.includes(previous.language) ? previous.language : "",
          sanitize: typeof previous.sanitize === "boolean" ? previous.sanitize : data.defaults.sanitize,
        });
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      }
    })();
    return () => controller.abort();
  }, [open, attempt]);

  const submit = async (event) => {
    event.preventDefault();
    if (!settings || busy || disabled || submitted.current) return;
    if (!options?.voices.includes(settings.voice)) {
      setVoiceError("please choose a valid voice");
      return;
    }
    setVoiceError("");
    submitted.current = true;
    stopSample();
    try { await onStart(settings); } finally { submitted.current = false; }
  };

  return (
    <Modal open={open} onClose={onClose} title='Narration settings' showCloseButton={!busy} closeOnBackdropClick={!busy} zIndex={40} role='dialog' aria-modal='true' aria-label='Narration settings'>
      <form onSubmit={submit} className='mx-auto flex max-w-lg flex-col gap-5'>
        <p className='text-sm text-dr-text-muted'>Choose Tangereen’s narration settings. Translation and sanitization apply only to the audio; your saved Virtual text stays unchanged.</p>
        {error ? (
          <div role='alert' className='text-sm text-dr-danger'>
            <p>{error}</p>
            <Button type='button' secondary onClick={() => setAttempt((value) => value + 1)}>Retry settings</Button>
          </div>
        ) : !settings || !options ? (
          <div role='status' className='flex items-center gap-2 text-sm'><Loading size={18} />Loading Tangereen settings…</div>
        ) : (
          <>
            <Select label='Voice' value={settings.voice} options={[{ value: "", label: "None" }, ...options.voices.map((value) => ({ value, label: label(value) }))]} onChange={chooseVoice} disabled={busy || disabled} />
            {voiceError && <p role='alert' className='text-sm text-dr-danger'>{voiceError}</p>}
            <div className='sr-only'>
              <p role='status' className='text-xs text-dr-text-muted'>{sampleStatus}</p>
              <audio ref={samplePlayer} hidden preload='none' aria-label={sampleVoice ? `${label(sampleVoice)} voice sample` : "Voice sample"} onEnded={() => setSampleStatus("Sample finished. Select another voice to preview it.")} />
            </div>
            <Select label='Translation language' value={settings.language} options={[{ value: "", label: "Original language — no translation" }, ...options.languages.map((value) => ({ value, label: label(value) }))]} onChange={(language) => {
              setSettings((current) => ({ ...current, language }));
              if (language && !options.voices.includes(settings.voice)) setVoiceError("please choose a valid voice");
            }} disabled={busy || disabled} />
            <div className='flex items-center justify-between gap-4'>
              <div><p className='text-sm font-semibold'>Sanitize before narration</p><p className='text-xs text-dr-text-muted'>Use Tangereen’s speech cleanup before translating or generating audio.</p></div>
              <Switch aria-label='Sanitize before narration' size='small' checked={settings.sanitize} onChange={(sanitize) => setSettings((current) => ({ ...current, sanitize }))} disabled={busy || disabled} />
            </div>
          </>
        )}
        <p className='text-xs text-dr-text-muted'>Generating narration uses your configured API account. A successful narration replaces the previous MP3.</p>
        <div className='flex justify-end gap-3'>
          <Button type='button' secondary onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type='submit' disabled={!settings || !!error || busy || disabled}>{busy ? "Starting…" : "Start narration"}</Button>
        </div>
      </form>
    </Modal>
  );
};