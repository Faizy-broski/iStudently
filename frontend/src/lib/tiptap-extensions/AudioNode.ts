import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Tiptap extension: renders an <audio controls> element.
 * Inserted via the AudioVideoRecorderDialog after a successful upload.
 */
export const AudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      'data-mime': { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'audio[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes({ controls: true, style: 'max-width:100%;display:block;margin:8px 0;' }, HTMLAttributes),
    ]
  },
})
