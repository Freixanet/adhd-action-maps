require('json')

Package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'NucleoPdfThumb'
  s.version        = Package['version']
  s.summary        = 'Rasterize PDF page 1 with PDFKit for the attach chip'
  s.description    = 'PDFKit first-page JPEG thumbnail for React Native'
  s.license        = Package['license']
  s.author         = 'Nucleo'
  s.homepage       = 'https://github.com/freixanet/nucleo'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks     = 'PDFKit'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
