import { EthAddress, ModalName } from '@darkforest_eth/types';
import React, { useState } from 'react';
import styled from 'styled-components';
import dfstyles, { PortalButton } from '../../Styles/dfstyles';
import {Text} from '../../Components/Text'
import { AccountView } from './AccountView';
import { Btn } from '../../Components/Btn';

export function PortalSidebarView({
    address
}: {
  address: EthAddress
}) {
  return (
    <SidebarContainer>
      <Text style = {{fontSize : '2em'}}>Dark Forest Arena</Text>
      <AccountView address = {address}/>
      <Btn variant = 'portal' size = 'large'>Design an Arena</Btn>
    </SidebarContainer>
  );
}

const SidebarContainer = styled.div`
position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100vh;
  padding: 16px 12px;
  box-sizing: border-box;
  z-index: 10;
  overflow-y: auto;
  width: 351px;
  top: 0;
  left: 0;
  border-right: 1px solid ${dfstyles.colors.border};
  background: rgba(255,255,255,0.04);
  gap: 15px;
`;
