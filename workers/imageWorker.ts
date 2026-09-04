export async function compressImageInWorker(file: File, maxWidth: number = 1920, quality: number = 0.7): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file);
        let width = bitmap.width;
        let height = bitmap.height;

        if (width > maxWidth || height > maxWidth) {
            const ratio = width / height;
            if (width > height) {
                width = maxWidth;
                height = width / ratio;
            } else {
                height = maxWidth;
                width = height * ratio;
            }
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Could not get OffscreenCanvas context");
        }

        ctx.drawImage(bitmap, 0, 0, width, height);
        
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        return new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified
        });
    } catch (error) {
        console.error("Worker compression failed, falling back to original file", error);
        throw error;
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { id, file, maxWidth, quality } = e.data;
    try {
        const compressedFile = await compressImageInWorker(file, maxWidth, quality);
        self.postMessage({ id, success: true, file: compressedFile });
    } catch (error: any) {
        self.postMessage({ id, success: false, error: error.message });
    }
};
