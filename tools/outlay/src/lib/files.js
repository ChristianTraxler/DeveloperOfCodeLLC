// Saves a text file. Inside a claude.ai published page this goes through the
// downloads capability; on your own domain it falls back to a normal download.
export async function saveTextFile(filename, text) {
  const host = typeof window !== 'undefined' ? window.claude : undefined;
  if (host && typeof host.use === 'function') {
    let downloads = null;
    try {
      downloads = await host.use('downloads');
    } catch {
      downloads = null;
    }
    if (downloads) {
      try {
        await downloads.save({ filename, data: text });
        return 'saved';
      } catch (err) {
        return err && err.code === 'declined' ? 'declined' : 'failed';
      }
    }
    return 'failed';
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

// Phone photos are large. Scale receipts to 2000px on the long side as JPEG before upload.
export async function prepareReceipt(file) {
  if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
