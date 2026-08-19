/**
 * Notice zone for ResultScreen. Does not reserve a header band — page content
 * continues behind the floating sidebar button.
 */

import React from 'react';
import { View } from 'react-native';
import IncompleteTransformBanner from './IncompleteTransformBanner';

type ResultNoticesZoneProps = {
  /** @deprecated Ignored — no header band. */
  hideProgressLine?: boolean;
  /** @deprecated Ignored — no header band. */
  headerVisibleShared?: unknown;
  /** @deprecated Ignored — no header band. */
  reserveHeaderSpace?: boolean;
};

export default function ResultNoticesZone(_props: ResultNoticesZoneProps) {
  return (
    <View pointerEvents="box-none">
      {/* A generated Núcleo is local-first. Cloud persistence retries remain in
          the durable background queues and must never displace its content. */}
      <IncompleteTransformBanner />
    </View>
  );
}
