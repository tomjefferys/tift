/**
 * Creates a promise that resolves when a ref value changes from its original value,
 * with a timeout to prevent infinite waiting.
 * 
 * @param ref - The ref to monitor for changes
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 100ms)
 * @param checkInterval - How often to check for changes in milliseconds (default: 10ms)
 * @returns Promise that resolves to true if ref changed to a truthy value, false otherwise
 */
export function createRefChangePromise<T>(
  ref : React.MutableRefObject<T>, 
  timeoutMs = 100,
  checkInterval = 10
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const originalValue = ref.current;
    const startTime = Date.now();
    
    const checkForChange = () => {
      if (ref.current !== originalValue) {
        // Resolve with true if the new value is truthy, false otherwise
        resolve(!!ref.current);
      } else if (Date.now() - startTime > timeoutMs) {
        // Timeout - resolve with false
        resolve(false);
      } else {
        // Check again after the specified interval
        setTimeout(checkForChange, checkInterval);
      }
    };
    
    // Start checking after the initial interval
    setTimeout(checkForChange, checkInterval);
  });
}

/**
 * Compresses a string using gzip compression and returns it as a base64 encoded string
 * @param data - The string to compress and encode
 * @returns Promise that resolves to the compressed and base64 encoded string
 */
/**
 * Compresses a string using gzip compression and returns it as a base64 encoded string
 * @param data - The string to compress and encode
 * @returns Promise that resolves to the compressed and base64 encoded string
 */
export async function compressAndEncode(data: string): Promise<string> {
  // Check if CompressionStream is available
  if (typeof CompressionStream === 'undefined') {
    return btoa(unescape(encodeURIComponent(data)));
  }
  
  try {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(data);
    
    // Create a promise-based approach for handling the streams
    const compressedData = await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      
      // Create compression stream
      const compressionStream = new CompressionStream('gzip');
      const reader = compressionStream.readable.getReader();
      
      // Handle reading compressed data
      const readChunks = async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
            }
          }
          
          // Combine chunks
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      // Start reading
      readChunks();
      
      // Write data to compression stream
      const writer = compressionStream.writable.getWriter();
      writer.write(uint8Array)
        .then(() => writer.close())
        .catch(reject);
    });

    // Convert to base64 using a more efficient method
    const base64 = arrayBufferToBase64(compressedData);
    
    return base64;
  } catch (error) {
    // Fallback to simple base64 encoding if compression fails
    return btoa(unescape(encodeURIComponent(data)));
  }
}

/**
 * Efficiently converts a Uint8Array to base64
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}


/**
 * Decompresses a base64 encoded gzip compressed string
 * @param encodedData - The base64 encoded compressed string
 * @returns Promise that resolves to the original uncompressed string
 */
export async function decodeAndDecompress(encodedData: string): Promise<string> {
    // Check browser support
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available in this browser');
    }
    
    // Convert base64 to Uint8Array
    const binaryString = atob(encodedData);
    const compressedData = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }
    
    // Create decompression stream
    const decompressionStream = new DecompressionStream('gzip');
    
    // Use promise-based approach to handle the streams properly
    const decompressedData = await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      const reader = decompressionStream.readable.getReader();
      
      // Handle reading decompressed data
      const readChunks = async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
            }
          }
          
          // Combine chunks
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          
          const result = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      // Start reading
      readChunks();
      
      // Write compressed data to decompression stream
      const writer = decompressionStream.writable.getWriter();
      writer.write(compressedData)
        .then(() => {
          return writer.close();
        })
        .catch((error) => {
          reject(error);
        });
    });
    
    // Convert to string
    const decoder = new TextDecoder();
    const result = decoder.decode(decompressedData);
    return result;
}

/**
 * Downloads text content as a file
 * @param filename - The name of the file to download
 * @param content - The text content to download
 */
export function downloadTextFile(filename: string, content: string): void {
  // Create a blob with the text content
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  
  // Create a URL for the blob
  const url = URL.createObjectURL(blob);
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  // Add to DOM, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Prompts the user to select and read a text file
 * @param title - The title to display in the file picker dialog
 * @param allowedExtensions - Array of file extensions to allow (e.g., ['.txt', '.json'])
 * @returns Promise that resolves to the file content as a string
 */
export function promptForTextFile(_title: string, allowedExtensions: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    
    // Set accepted file types
    if (allowedExtensions && allowedExtensions.length > 0) {
      input.accept = allowedExtensions.join(',');
    }
    
    // Handle file selection
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      // Create a FileReader to read the file content
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
        
        // Clean up
        document.body.removeChild(input);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
        document.body.removeChild(input);
      };
      
      // Read the file as text
      reader.readAsText(file);
    });
    
    // Handle cancellation
    input.addEventListener('cancel', () => {
      reject(new Error('File selection cancelled'));
      document.body.removeChild(input);
    });
    
    // Add to DOM and trigger click
    document.body.appendChild(input);
    input.click();
  });
}