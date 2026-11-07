/**
 * Helper utilities for client-side image processing, file reading, and lightweight canvas compression.
 * Enables instant upload of school facilities and gallery images from device/camera or URL.
 */

export async function processImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image data.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates and processes a passport or profile photograph for students, teachers, or administrators.
 * Strictly enforces that uploaded files are 100KB or lower, and formats to a crisp lightweight JPEG.
 */
export async function processPassportPhoto(
  file: File,
  maxSizeBytes = 100 * 1024
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image. Please select a JPG or PNG file.');
  }

  if (file.size > maxSizeBytes) {
    const sizeInKb = (file.size / 1024).toFixed(1);
    throw new Error(
      `Passport photograph must be 100KB or lower. Selected file is ${sizeInKb}KB.`
    );
  }

  try {
    // Passport photos standard dimensions (400x400 max)
    return await processImageFile(file, 400, 0.85);
  } catch {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read passport photograph.'));
      reader.readAsDataURL(file);
    });
  }
}
