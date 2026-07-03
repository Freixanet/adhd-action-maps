# macOS: mantener la Mac despierta para Núcleo local

Núcleo en iPhone depende de backend (3000) y Metro (8082) en tu Mac. Los LaunchAgents ya envuelven cada servicio con `caffeinate -dimsu`, pero macOS puede dormir el sistema por energía, tapa cerrada o batería.

## 1. Ver configuración actual

```bash
pmset -g custom
```

## 2. Opción recomendada en corriente (AC)

Ejecuta manualmente (requiere `sudo`):

```bash
sudo pmset -c sleep 0
sudo pmset -c displaysleep 30
sudo pmset -c disksleep 0
sudo pmset -c powernap 1
sudo pmset -c tcpkeepalive 1
sudo pmset -c womp 1
```

### Qué hace cada ajuste

| Ajuste | Efecto |
|--------|--------|
| `sleep 0` | Evita reposo del sistema con cargador conectado |
| `displaysleep 30` | Apaga pantalla a los 30 min sin dormir el sistema |
| `disksleep 0` | Discos activos en corriente |
| `powernap` | Permite tareas en background en corriente |
| `tcpkeepalive` | Mantiene conexiones de red activas |
| `womp` | Wake on network (útil en LAN) |

## 3. Cómo encaja con Núcleo

- **`caffeinate` en los LaunchAgents** mantiene el sistema despierto mientras backend/Metro están vivos.
- **`sleep 0` en corriente** evita que macOS duerma el sistema aunque no haya interacción.
- **`displaysleep 30`** permite apagar pantalla sin cortar backend/Metro.
- **Tapa cerrada** puede forzar reposo igualmente, salvo modo clamshell con monitor externo.
- **En batería** no se recomienda `sleep 0`; el Mac puede dormir y el iPhone dejará de conectar.

## 4. Revertir cambios

```bash
sudo pmset restoredefaults
```

O ajusta manualmente en **Ajustes del Sistema → Batería / Energía**.

## 5. Recomendaciones prácticas

- Usa **cargador conectado** para sesiones always-on.
- Deja la **tapa abierta** si no usas clamshell.
- Comprueba **temperatura** y ventilación.
- No bloquees rejillas de ventilación.
- Si cambia la IP de la Mac, ejecuta:

```bash
./scripts/local-runtime/install-nucleo-local-runtime.sh --fix-env
```
