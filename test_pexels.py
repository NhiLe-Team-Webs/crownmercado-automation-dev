import traceback, urllib.request, urllib.parse, json
api_key = 'ylkNtwzFD1eBzpIngvx4Abb9zwBjl9D5CYCx9QVYu11BCS0avqFyj7pC'
query = 'creative team brainstorming'
url = f'https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page=3&orientation=landscape'
req = urllib.request.Request(url, headers={'Authorization': api_key, 'User-Agent': 'Mozilla/5.0'})
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode())
    print('SUCCESS', len(data.get('videos', [])))
    for v in data.get('videos', []):
        print(v['url'])
except Exception as e:
    traceback.print_exc()
