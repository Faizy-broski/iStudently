import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Tiptap extension: renders a <video controls> element.
 * Inserted via the AudioVideoRecorderDialog after a successful upload.
 */
export const VideoNode = Node.create({
  name: 'video',
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
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes({
        controls: true,
        style: 'max-width:100%;display:block;margin:8px 0;',
      }, HTMLAttributes),
    ]
  },
})
