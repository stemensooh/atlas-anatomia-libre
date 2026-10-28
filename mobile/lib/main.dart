import 'package:flutter/material.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

void main() => runApp(const AtlasMobileApp());

class AtlasMobileApp extends StatelessWidget {
  const AtlasMobileApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Atlas Anatómico 3D',
        theme: ThemeData.dark(useMaterial3: true),
        home: const SkeletalViewerScreen(),
      );
}

class SkeletalViewerScreen extends StatelessWidget {
  const SkeletalViewerScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Atlas anatómico · Esqueleto')),
        body: const ModelViewer(
          // model-viewer no expone MeshoptDecoder; esta copia conserva las
          // 281 estructuras del esqueleto sin EXT_meshopt_compression.
          src: 'data/development/skeletal-uncompressed.glb',
          alt: 'Esqueleto humano',
          ar: false,
          autoRotate: false,
          disableZoom: false,
          backgroundColor: Color(0xff0b1120),
        ),
      );
}
