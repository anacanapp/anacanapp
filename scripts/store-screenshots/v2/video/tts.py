import sys, json, urllib.request, os
KEY = open(os.environ['EL_KEY_FILE']).read().strip()
VOICE = os.environ.get('EL_VOICE', 'r1KmysJdVYZjJCm4mL3b')
def tts(text, out, model):
    body = {'text': text, 'model_id': model, 'language_code': 'az', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.85, 'style': 0.25, 'use_speaker_boost': True}}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_192', data=json.dumps(body).encode(),
                                 headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    try: open(out, 'wb').write(urllib.request.urlopen(req, timeout=300).read()); return 'ok'
    except urllib.error.HTTPError as e: return f'ERR {e.code} {e.read().decode()[:200]}'
if __name__ == '__main__':
    print(tts(sys.argv[1], sys.argv[2], sys.argv[3]))
