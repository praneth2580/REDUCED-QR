import HuffmanDemoUI from './demos/huffman.ui';
import BasicRLEDemoUI from './demos/basic_rle.ui';
import DictionaryDemoUI from './demos/dictionary.ui';
import HuffmanWordDemoUI from './demos/huffman.word.ui';
import DictionaryGroupDemoUI from './demos/dictionary.group.ui';
import HuffmanDictionaryDemoUI from './demos/huffman_dict_group.ui';
import AllInOneDemoUI from './demos/allinone.ui';
import BitFileSaver from './pages/bit_file_saver.ui';
import BitFileLoader from './pages/bit_file_loader.ui';
import QrDecoder from './pages/qr_decoder.ui';
import QRExtractor from './demos/qr_extractor.ui';

export const routesConfig = [
  {
    path: '/',
    name: 'Home',
    inNav: true,
  },
  {
    path: '/demo',
    name: 'Demos',
    inNav: true,
    children: [
      {
        path: 'huffman',
        element: <HuffmanDemoUI />,
        name: 'Huffman (Characters)',
        inNav: true,
      },
      {
        path: 'huffman-word',
        element: <HuffmanWordDemoUI />,
        name: 'Huffman (Words)',
        inNav: true,
      },
      {
        path: 'rle',
        element: <BasicRLEDemoUI />,
        name: 'RLE Encoder',
        inNav: true,
      },
      {
        path: 'dictionary',
        element: <DictionaryDemoUI />,
        name: 'Dictionary (Words)',
        inNav: true,
      },
      {
        path: 'dictionary-group',
        element: <DictionaryGroupDemoUI />,
        name: 'Dictionary (Groups)',
        inNav: true,
      },
      {
        path: 'huffman-dictionary-group',
        element: <HuffmanDictionaryDemoUI />,
        name: 'Huffman -> Dictionary (Groups)',
        inNav: true,
      },
      {
        path: 'all-in-one',
        element: <AllInOneDemoUI />,
        name: 'All IN One',
        inNav: true,
      },
    ],
  },
  {
    path: '/bin',
    name: 'Binary',
    inNav: true,
    children: [
      {
        path: 'bit-file-saver',
        element: <BitFileSaver />,
        name: 'Text to File',
        inNav: true,
      },
      {
        path: 'bit-file-loader',
        element: <BitFileLoader />,
        name: 'File to Text',
        inNav: true,
      },
    ],
  },
  {
    path: '/qr',
    name: 'QR',
    inNav: true,
    children: [
      {
        path: 'qr-decoder',
        element: <QrDecoder/>,
        name: 'Image to Text',
        inNav: true,
      },
      {
        path: 'qr-extractor',
        element: <QRExtractor/>,
        name: 'Qr Extractor',
        inNav: true,
      },
    ],
  },
];
