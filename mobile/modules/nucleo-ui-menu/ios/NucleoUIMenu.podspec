require('json')

Package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'NucleoUIMenu'
  s.version        = Package['version']
  s.summary        = 'Present native iOS UIMenu from a screen anchor'
  s.description    = 'Present native iOS UIMenu from a screen anchor'
  s.license        = Package['license']
  s.author         = 'Nucleo'
  s.homepage       = 'https://github.com/freixanet/nucleo'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
