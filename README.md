# Screenshot Service with Security Headers

A secure screenshot service that requires a valid security header for all screenshot requests.

## Security Features

The service now requires a security header for all `/screenshot` requests. This prevents unauthorized access to your screenshot service.

### Configuration

Set the following environment variables to configure security:

- `SECURITY_HEADER_NAME`: Name of the security header (default: `X-Screenshot-Token`)
- `SECURITY_HEADER_VALUE`: Expected value for the security header (default: `your-secret-token-here`)

### Usage

#### With curl:
```bash
# Without security header (will fail)
curl "http://localhost:8080/screenshot?url=https://example.com"

# With valid security header
curl -H "X-Screenshot-Token: your-secret-token-here" \
  "http://localhost:8080/screenshot?url=https://example.com"
```

#### With JavaScript (fetch):
```javascript
const response = await fetch('http://localhost:8080/screenshot?url=https://example.com', {
  headers: {
    'X-Screenshot-Token': 'your-secret-token-here'
  }
});
const screenshot = await response.blob();
```

#### With Python (requests):
```python
import requests

url = "http://localhost:8080/screenshot?url=https://example.com"
headers = {"X-Screenshot-Token": "your-secret-token-here"}
response = requests.get(url, headers=headers)
```

### Endpoints

- `GET /screenshot` - Takes screenshots (requires security header)
  - Parameters: `url`, `format`, `full_page`, `clip_x`, `clip_y`, `clip_width`, `clip_height`, `selector`, `delay`, `image_quality`, `timeout`
- `GET /health` - Health check (no security required)

### Error Responses

- **401 Unauthorized**: Missing security header
- **403 Forbidden**: Invalid security token
- **400 Bad Request**: Missing required parameters
- **500 Internal Server Error**: Screenshot generation failed

### Running the Service

```bash
# Start the service
node server.js

# With custom security configuration
SECURITY_HEADER_NAME="My-Custom-Header" \
SECURITY_HEADER_VALUE="my-secret-value" \
node server.js
```

### Testing

Test the security implementation:

1. Start the server: `node server.js`
2. Test without header (should fail):
   ```bash
   curl "http://localhost:8080/screenshot?url=https://example.com"
   ```
3. Test with valid header (should succeed):
   ```bash
   curl -H "X-Screenshot-Token: your-secret-token-here" \
     "http://localhost:8080/screenshot?url=https://example.com" \
     --output screenshot.jpg
   ```
4. Test health endpoint (should work without header):
   ```bash
   curl "http://localhost:8080/health"
   ```
