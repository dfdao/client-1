import React from 'react';
import { useHistory } from 'react-router-dom';
import { LobbyAdminTools } from '../../../Backend/Utils/LobbyAdminTools';
import { Btn } from '../../Components/Btn';
import { Spacer, Title } from '../../Components/CoreUI';
import { Row } from '../../Components/Row';
import { CreatePlanetPane } from './CreatePlanetPane';
import { LobbyConfigAction, LobbyConfigState } from './Reducer';
import { WhitelistPane } from './WhitelistPane';

export function ExtrasNavPane({
  lobbyAdminTools,
  config,
  onUpdate,
  lobbyContent,
  root,
}: {
  lobbyAdminTools: LobbyAdminTools | undefined;
  config: LobbyConfigState;
  onUpdate: (lobbyConfigAction: LobbyConfigAction) => void;
  lobbyContent: JSX.Element;
  root: string;
}) {
  const history = useHistory();

  const handleEnter = () => {
    const warnings = [];
    if (config.ADMIN_PLANETS.displayValue && config.ADMIN_PLANETS.displayValue.length > 0) {
      warnings.push('Some planets are still staged for creation');
    }
    if (config.WHITELIST.displayValue && config.WHITELIST.displayValue.length > 0) {
      warnings.push('Some addresses are still staged for allowlist');
    }
    if (
      config.MANUAL_SPAWN.displayValue &&
      !lobbyAdminTools?.planets.find((p) => p.isSpawnPlanet)
    ) {
      warnings.push('Manual spawn is active but no spawn planets have been created');
    }
    if (
      config.TARGET_PLANETS.displayValue &&
      !lobbyAdminTools?.planets.find((p) => p.isTargetPlanet)
    ) {
      warnings.push('Target planets are active but no target planets have been created');
    }
    if (warnings.length > 0) {
      const confirmed = confirm(
        `WARNING: \n${warnings.reduce(
          (prev, curr, idx) => prev.concat(`${idx + 1}: ${curr}\n`),
          ''
        )} Do you want to continue?`
      );
      if (!confirmed) return;
    }
    window.open(url);
  };

  const url = `${window.location.origin}/play/${lobbyAdminTools?.address}`;

  const views = [
    <CreatePlanetPane config={config} onUpdate={onUpdate} lobbyAdminTools={lobbyAdminTools} />,
    <WhitelistPane config={config} onUpdate={onUpdate} lobbyAdminTools={lobbyAdminTools} />,
  ];
  return (
    <>
      <Title slot='title'>Add Planets</Title>
      <div>
        Now add planets to your universe!
        <Spacer height={12} />
        Remember, if you want to play with manual spawning, you must create at least one spawn
        planet.
        <Spacer height={12} />
      </div>
      <CreatePlanetPane config={config} onUpdate={onUpdate} lobbyAdminTools={lobbyAdminTools} />
      <Spacer height={20} />
      {lobbyAdminTools?.address ? (
        <Btn size='stretch' onClick={handleEnter}>
          Enter Universe
        </Btn>
      ) : (
        <Row>
          <Btn onClick={() => history.push(`${root}/settings`)}>← World Settings</Btn>
        </Row>
      )}
      {lobbyContent}
    </>
  );
}
