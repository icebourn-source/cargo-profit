// Загрузка фото: читаем файл, ужимаем до maxSize px и возвращаем data URL (JPEG).
// Так фото занимает десятки КБ и помещается в localStorage.
export function fileToDataUrl(file: File, maxSize = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsDataURL(file)
  })
}
