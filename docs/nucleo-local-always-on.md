# Núcleo local always-on

Mantiene **backend + Metro** activos en tu Mac mediante **LaunchAgents** de macOS y `caffeinate`, sin terminales abiertas.

## Qué resuelve

Puedes usar Núcleo en iPhone **sin abrir terminales**, mientras la Mac esté encendida, despierta y en la misma Wi-Fi que el iPhone.

## Qué no resuelve

- No hace la app independiente de la Mac.
- Si la Mac se apaga, pierde Wi-Fi o duerme (tapa cerrada / batería), la app puede dejar de generar.
- Para independencia real hará falta **EAS + backend remoto** más adelante.

## Instalar

```bash
cd /Users/mfreixanet/antigravity/Untitled-mobile-preview
./scripts/local-runtime/install-nucleo-local-runtime.sh --fix-env
```

`--fix-env` actualiza `mobile/.env` con la IP actual de la Mac:

```env
EXPO_PUBLIC_API_BASE_URL=http://CURRENT_MAC_IP:3000
```

## Estado

```bash
./scripts/local-runtime/status-nucleo-local-runtime.sh
```

Muestra IP, `.env`, LaunchAgents, puertos 3000/8082, health checks y últimas líneas de logs.

## Parar temporalmente

```bash
./scripts/local-runtime/stop-nucleo-local-runtime.sh
```

Detiene los LaunchAgents y libera puertos. Los `.plist` permanecen instalados.

## Arrancar de nuevo

```bash
./scripts/local-runtime/start-nucleo-local-runtime.sh
```

## Desinstalar

```bash
./scripts/local-runtime/uninstall-nucleo-local-runtime.sh
```

Opcional: `--remove-logs` borra logs en `.local-runtime/logs/`.

## Uso en iPhone

1. Mac conectada a corriente (recomendado).
2. Mac en la misma Wi-Fi que el iPhone.
3. Ejecutar **install** una vez (o de nuevo si cambió la IP con `--fix-env`).
4. Abrir **Núcleo** (dev client) en iPhone.

Si aparece **No development servers found** (normal con Metro en segundo plano):

- **Opción A:** en Safari del iPhone abre  
  `http://TU_IP_MAC:8081/_expo/link?choice=expo-dev-client&platform=ios`
- **Opción B:** en el dev client → **Enter URL manually** → `TU_IP_MAC:8081`
- **Ajustes → Núcleo → Red local** debe estar activado.
- Prueba en Safari: `http://TU_IP_MAC:8081/status` → `packager-status:running`

En la Mac: `./scripts/local-runtime/connect-iphone-dev.sh` imprime el enlace con tu IP.

5. Si sale error rojo, **Reload JS**.
6. Generar mapa.
7. Si falla, revisar `status` y logs.

## Servicios

| Servicio | Puerto | LaunchAgent |
|----------|--------|-------------|
| Backend | 3000 | `com.nucleo.backend` |
| Metro | 8081 | `com.nucleo.metro` |

Health checks usan:

- Backend: `GET /health`
- Metro: `GET /status`

## Logs

```
.local-runtime/logs/backend.log
.local-runtime/logs/backend.err.log
.local-runtime/logs/metro.log
.local-runtime/logs/metro.err.log
```

## Energía macOS

Ver recomendaciones en [macos-keep-awake-for-nucleo.md](./macos-keep-awake-for-nucleo.md).

## Limitaciones

- Mac debe seguir encendida.
- Mejor conectada a corriente.
- Tapa cerrada puede dormir el sistema salvo clamshell.
- Si cambia la IP, ejecutar install con `--fix-env`.
- No sustituye backend remoto ni EAS.
