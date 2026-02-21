# Image Generation

Use google gemini api to generate images

Sample Code

```
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "A hyper realistic product photo of a stainless steel water bottle on white background"
      }]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"]
    }
  }'

```

1. Add a new endpoint in the app /api/image-generate
2. Given a prompt generate two images and return url
3. Check if there is any settings to be set while calling the api, such that url can be loaded without worying about cors
4. Set the settings to normal resolution if applicable, not low or not too high
5. Primary goal is to generate an image that can be used as "Coloring book" , that is should have clear defined borders

- No shades in the background, that is perfect black and white
- Currently using javascript to remove the background from the generated image, so the image generated should be simplistic, that a simple script can remove the background (ie all white background, leaving dark/black shade borders or features)
- Eg: Customer asks "A boy playing football", then should generate a boy playing football , with just dark outline, my app will remove the background and process it in my app
