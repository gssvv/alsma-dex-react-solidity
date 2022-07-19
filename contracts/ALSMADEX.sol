// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "hardhat/console.sol";

/*
  Sorry, use https://translate.google.com/

  Фукнционал:
  - Обменивать одну монету на другую (MATIC/KBTC/KUSDT) за счет пула
  - Хранить и обновлять курс MATIC и KBTC через Oracle Chainlink
  - Возможность фарминга монеты за счет пополнения пула
    - Система расчета комиссии и прибыли, чтобы экономика имела смысл
  - Возможность добавлять новые монеты (контракты) для обмена/фарминга (onlyOwner)
*/

contract ALSMADEX {
    struct MappingEntry {
        string name;
    }
    mapping(address => mapping(address => MappingEntry)) name;
}
