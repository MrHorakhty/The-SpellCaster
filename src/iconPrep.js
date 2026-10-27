// Pixel maths stays independent of Image/canvas so Node checks exercise the
// same segmentation and geometry used by the upload dialog.
export const ICON_SIZE = 256
export const ICON_PADDING = 20
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function otsuThreshold(histogram) {
    const total = histogram.reduce((a, b) => a + b, 0)
    const sum = histogram.reduce((a, count, i) => a + count * i, 0)
    let weight = 0, mean = 0, best = -1, threshold = 0
    for (let i = 0; i < 256; i++) {
        weight += histogram[i]
        mean += histogram[i] * i
        if (!weight || weight === total) continue
        const delta = mean / weight - (sum - mean) / (total - weight)
        const variance = weight * (total - weight) * delta * delta
        if (variance > best) { best = variance; threshold = i }
    }
    return (threshold + 0.5) / 256
}

export function cleanComponents(alpha, width, height) {
    const labels = new Int32Array(alpha.length)
    const queue = new Int32Array(alpha.length)
    const sizes = [0]
    let count = 0
    for (let start = 0; start < alpha.length; start++) {
        if (alpha[start] <= 127 || labels[start]) continue
        count++
        let head = 0, tail = 1
        queue[0] = start
        labels[start] = count
        while (head < tail) {
            const index = queue[head++]
            const x = index % width, y = Math.floor(index / width)
            // Avoid allocating a neighbour array for every foreground pixel.
            if (x && alpha[index - 1] > 127 && !labels[index - 1]) {
                labels[index - 1] = count; queue[tail++] = index - 1
            }
            if (x + 1 < width && alpha[index + 1] > 127 && !labels[index + 1]) {
                labels[index + 1] = count; queue[tail++] = index + 1
            }
            if (y && alpha[index - width] > 127 && !labels[index - width]) {
                labels[index - width] = count; queue[tail++] = index - width
            }
            if (y + 1 < height && alpha[index + width] > 127 && !labels[index + width]) {
                labels[index + width] = count; queue[tail++] = index + width
            }
        }
        sizes.push(tail)
    }
    // Entirely translucent artwork is valid; do not silently erase it.
    if (!count) return alpha.slice()
    const largest = sizes.reduce((a, b) => Math.max(a, b), 0)
    const keep = sizes.map((size, i) => i > 0 && size >= largest * 0.02)
    const output = new Uint8ClampedArray(alpha.length)
    for (let i = 0; i < alpha.length; i++) {
        if (!alpha[i]) continue
        if (labels[i]) { if (keep[labels[i]]) output[i] = alpha[i]; continue }
        // Preserve the one-pixel smoothstep fringe around retained solid art.
        const x = i % width, y = Math.floor(i / width)
        for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
            for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
                if (keep[labels[yy * width + xx]]) output[i] = alpha[i]
            }
        }
    }
    return output
}

export function segmentAlpha(rgba, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) {
        throw new Error('Invalid image dimensions or pixel buffer.')
    }
    const channels = [[], [], []]
    const ring = Math.max(1, Math.floor(Math.min(width, height) * 0.02))
    let borderCount = 0, transparentCount = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue
        const i = (y * width + x) * 4
        borderCount++
        if (rgba[i + 3] <= 8) { transparentCount++; continue }
        for (let c = 0; c < 3; c++) channels[c].push(rgba[i + c])
    }
    const sourceAlpha = new Uint8ClampedArray(width * height)
    for (let i = 0; i < sourceAlpha.length; i++) sourceAlpha[i] = rgba[i * 4 + 3]
    // Existing predominantly transparent borders already supply a background mask.
    // Do not reinterpret invisible RGB bytes as art or erase a flat grey icon.
    if (transparentCount > borderCount / 2) return cleanComponents(sourceAlpha, width, height)
    const median = channels.map(values => {
        values.sort((a, b) => a - b)
        const middle = Math.floor(values.length / 2)
        return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
    })
    const distances = new Float32Array(width * height)
    const histogram = new Uint32Array(256)
    for (let i = 0; i < distances.length; i++) {
        if (!sourceAlpha[i]) continue
        const index = i * 4
        const d = Math.max(Math.abs(rgba[index] - median[0]), Math.abs(rgba[index + 1] - median[1]),
            Math.abs(rgba[index + 2] - median[2])) / 255
        distances[i] = d
        histogram[Math.min(255, Math.floor(d * 256))]++
    }
    const threshold = otsuThreshold(histogram)
    const low = Math.max(0, threshold - 0.06), high = Math.min(1, threshold + 0.10)
    const alpha = new Uint8ClampedArray(distances.length)
    const band = Math.max(0.000001, high - low)
    for (let i = 0; i < alpha.length; i++) {
        const t = clamp((distances[i] - low) / band, 0, 1)
        alpha[i] = t * t * (3 - 2 * t) * sourceAlpha[i]
    }
    return cleanComponents(alpha, width, height)
}

export function cropToSquare(width, height, { x = 0, y = 0, scale = 1 } = {}) {
    if (!(width > 0 && height > 0)) throw new Error('Invalid crop dimensions.')
    const side = Math.min(width, height) / clamp(scale, 1, 8)
    return {
        x: (width - side) * (clamp(x, -1, 1) + 1) / 2,
        y: (height - side) * (clamp(y, -1, 1) + 1) / 2,
        side,
    }
}

const decodedIcons = new WeakMap()

// A File is decoded once across operation changes and StrictMode's effect
// replay. Weak keys let the decoded image go when the upload is discarded.
export function decodeIcon(blob) {
    const cached = decodedIcons.get(blob)
    if (cached) return cached
    const pending = loadIcon(blob)
    decodedIcons.set(blob, pending)
    pending.catch(() => { if (decodedIcons.get(blob) === pending) decodedIcons.delete(blob) })
    return pending
}

async function loadIcon(blob) {
    const url = URL.createObjectURL(blob)
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => image.naturalWidth && image.naturalHeight
                ? resolve(image) : reject(new Error('This image has no readable dimensions.'))
            image.onerror = () => reject(new Error('This file could not be decoded as an image.'))
            image.src = url
        })
    } finally { URL.revokeObjectURL(url) }
}

export function drawIconCrop(image, canvas, opts = {}) {
    if (canvas.width !== ICON_SIZE || canvas.height !== ICON_SIZE) canvas.width = canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is unavailable.')
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE)
    const crop = cropToSquare(image.naturalWidth, image.naturalHeight, opts)
    ctx.drawImage(image, crop.x, crop.y, crop.side, crop.side, 0, 0, ICON_SIZE, ICON_SIZE)
}

export async function prepareIcon(blob, mode, opts = {}) {
    if (!['original', 'crop', 'silhouette'].includes(mode)) throw new Error('Choose an icon operation.')
    const image = await decodeIcon(blob)
    // Validate that it can be previewed, but preserve the actual file bytes/type.
    if (mode === 'original') return blob
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is unavailable.')
    if (mode === 'crop') {
        drawIconCrop(image, canvas, opts)
    } else {
        const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
        const work = document.createElement('canvas')
        work.width = Math.max(1, Math.round(image.naturalWidth * ratio))
        work.height = Math.max(1, Math.round(image.naturalHeight * ratio))
        const workCtx = work.getContext('2d')
        if (!workCtx) throw new Error('Image processing is unavailable.')
        workCtx.drawImage(image, 0, 0, work.width, work.height)
        const pixels = workCtx.getImageData(0, 0, work.width, work.height)
        const alpha = segmentAlpha(pixels.data, work.width, work.height)
        let left = work.width, top = work.height, right = -1, bottom = -1
        for (let i = 0; i < alpha.length; i++) {
            const index = i * 4
            pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 106
            pixels.data[index + 3] = alpha[i]
            if (alpha[i]) {
                const x = i % work.width, y = Math.floor(i / work.width)
                left = Math.min(left, x); right = Math.max(right, x)
                top = Math.min(top, y); bottom = Math.max(bottom, y)
            }
        }
        workCtx.putImageData(pixels, 0, 0)
        if (right >= left) {
            const width = right - left + 1, height = bottom - top + 1
            const fit = (ICON_SIZE - ICON_PADDING * 2) / Math.max(width, height)
            ctx.drawImage(work, left, top, width, height,
                (ICON_SIZE - width * fit) / 2, (ICON_SIZE - height * fit) / 2, width * fit, height * fit)
        }
    }
    return await new Promise((resolve, reject) => canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('Could not encode the prepared icon.')), 'image/png'))
}
